'use client';

import {useRef, useState} from 'react';
import {Button} from '@/components/ui/button';
import {isCompletePrivateBackup} from '@/lib/private-backup';

export default function Download() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const download = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus('Reading saved data…');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch('/api/private-backup', {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw Error(response.status === 401
        ? 'Sign in again before downloading.'
        : 'Could not read the private backup. Try again.');
      const data: unknown = await response.json();
      if (!isCompletePrivateBackup(data)) throw Error('Incomplete backup response. Try again.');

      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'labula-private-backup.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus('Backup downloaded: ' + Object.entries(data.counts).map(([table, count]) => table + ' ' + count).join(' · '));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download failed. Retry.');
    } finally {
      clearTimeout(timer);
      lock.current = false;
      setBusy(false);
    }
  };

  return <>
    <Button disabled={busy} onClick={() => void download()}>Download complete private backup</Button>
    <p role="status">{status}</p>
  </>;
}
