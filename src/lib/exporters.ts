import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { sampleAt, totalDuration } from './anim';
import { drawFrameCard, frameCardSize, renderLineupCard, type Theme } from './render';
import { buildScene } from './scene';
import type { Player, Tactic } from '../types';

export interface Output {
  blob: Blob;
  filename: string;
  kind: 'image' | 'video';
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('이미지를 만들지 못했어요'))), 'image/png'));

const tick = () => new Promise<void>(r => setTimeout(r, 0));
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim() || '축구방';

export async function exportLineupPng(tactic: Tactic, roster: Player[], theme: Theme): Promise<Output> {
  const blob = await toBlob(renderLineupCard(tactic, roster, theme));
  return { blob, filename: `${safeName(tactic.name)}-라인업.png`, kind: 'image' };
}

function frameCanvas(width: number) {
  const size = frameCardSize(width);
  const canvas = document.createElement('canvas');
  canvas.width = size.width; canvas.height = size.height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! };
}

function drawAt(ctx: CanvasRenderingContext2D, tactic: Tactic, roster: Player[], ms: number, width: number, theme: Theme) {
  const s = sampleAt(tactic.frames, ms);
  const scene = buildScene(tactic, roster, s.positions, s.ball, null, s.drawings);
  drawFrameCard(ctx, tactic, scene, {
    width,
    theme,
    label: `장면 ${Math.min(s.noteIndex + 1, tactic.frames.length)} / ${tactic.frames.length}`,
    note: tactic.frames[s.noteIndex]?.note ?? '',
  });
}

export async function exportFramePng(tactic: Tactic, roster: Player[], index: number, theme: Theme): Promise<Output> {
  const f = tactic.frames[index];
  const { canvas, ctx } = frameCanvas(1080);
  const prev = tactic.frames[index - 1]?.positions ?? null;
  drawFrameCard(ctx, tactic, buildScene(tactic, roster, f.positions, f.ball, prev, f.drawings.map(d => ({ ...d, alpha: 1 }))), {
    width: 1080,
    theme,
    label: `장면 ${index + 1} / ${tactic.frames.length}`,
    note: f.note,
  });
  return { blob: await toBlob(canvas), filename: `${safeName(tactic.name)}-장면${index + 1}.png`, kind: 'image' };
}

export async function exportGif(
  tactic: Tactic, roster: Player[], speed: number, theme: Theme, onProgress: (p: number) => void,
): Promise<Output> {
  const width = 480;
  const fps = 15;
  const { canvas, ctx } = frameCanvas(width);
  const total = totalDuration(tactic.frames.length) + 600;
  const step = 1000 / fps;
  const count = Math.max(2, Math.ceil(total / speed / step));
  const gif = GIFEncoder();
  for (let i = 0; i < count; i++) {
    drawAt(ctx, tactic, roster, i * step * speed, width, theme);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256, { format: 'rgb444' });
    const index = applyPalette(data, palette, 'rgb444');
    gif.writeFrame(index, canvas.width, canvas.height, { palette, delay: Math.round(step), repeat: 0 });
    onProgress((i + 1) / count);
    await tick();
  }
  gif.finish();
  return { blob: new Blob([gif.bytes() as BlobPart], { type: 'image/gif' }), filename: `${safeName(tactic.name)}-전술.gif`, kind: 'image' };
}

export function videoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function exportVideo(
  tactic: Tactic, roster: Player[], speed: number, theme: Theme, onProgress: (p: number) => void,
): Promise<Output> {
  const width = 720;
  const { canvas, ctx } = frameCanvas(width);
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('이 브라우저는 영상 저장을 지원하지 않아요. GIF를 이용해 주세요.');
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const total = (totalDuration(tactic.frames.length) + 800) / speed;

  drawAt(ctx, tactic, roster, 0, width, theme);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise<void>(res => (rec.onstop = () => res()));
  rec.start(250);

  await new Promise<void>(res => {
    const t0 = performance.now();
    const loop = () => {
      const el = performance.now() - t0;
      drawAt(ctx, tactic, roster, el * speed, width, theme);
      onProgress(Math.min(1, el / total));
      if (el >= total) res(); else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  rec.stop();
  stream.getTracks().forEach(t => t.stop());
  await done;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), filename: `${safeName(tactic.name)}-전술.${ext}`, kind: 'video' };
}

export function download(out: Output) {
  const url = URL.createObjectURL(out.blob);
  const a = document.createElement('a');
  a.href = url; a.download = out.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFile(out: Output): boolean {
  if (!navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([out.blob], out.filename, { type: out.blob.type })] });
  } catch {
    return false;
  }
}

/** Opens the OS share sheet (KakaoTalk shows up there on phones). */
export async function share(out: Output, title: string): Promise<void> {
  const file = new File([out.blob], out.filename, { type: out.blob.type });
  try {
    await navigator.share({ files: [file], title });
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') throw e;
  }
}
