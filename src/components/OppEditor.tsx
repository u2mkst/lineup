import { useState } from 'react';
import { Sheet } from './Sheet';

interface Props {
  role: string;
  value: { number: string; name: string };
  onSave: (v: { number: string; name: string }) => void;
  onClose: () => void;
}

export function OppEditor({ role, value, onSave, onClose }: Props) {
  const [number, setNumber] = useState(value.number);
  const [name, setName] = useState(value.name);
  const save = () => onSave({ number: number.trim().slice(0, 3), name: name.trim().slice(0, 8) });
  return (
    <Sheet title={`상대 선수 (${role})`} onClose={onClose}>
      <form className="form-col" onSubmit={e => { e.preventDefault(); save(); }}>
        <label className="field">
          <span>등번호</span>
          <input value={number} inputMode="numeric" maxLength={3} autoFocus onChange={e => setNumber(e.target.value)} />
        </label>
        <label className="field">
          <span>이름 (선택)</span>
          <input value={name} maxLength={8} onChange={e => setName(e.target.value)} />
        </label>
        <button className="btn primary" type="submit">저장</button>
      </form>
    </Sheet>
  );
}
