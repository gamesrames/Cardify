import { useEffect, useMemo, useState } from 'react';
import { signedPhotoUrls } from './supabase';

/** As URLs assinadas do Storage valem 1 h; renova antes disso para uma partida longa não perder as fotos. */
const REFRESH_MS = 45 * 60 * 1000;

/**
 * `photos` = id da carta → caminho da foto (vem na visão da partida: as minhas e as do adversário que já foram
 * jogadas). Devolve id da carta → endereço assinado, para o `CardView` achar a foto pelo contexto.
 */
export function useMatchPhotos(photos: Record<string, string> | undefined): Record<string, string> {
  const key = useMemo(() => JSON.stringify(Object.entries(photos ?? {}).sort(([a], [b]) => a.localeCompare(b))), [photos]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [round, setRound] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRound((r) => r + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const entries = JSON.parse(key) as [string, string][];
    if (entries.length === 0) return;
    let cancelled = false;
    signedPhotoUrls([...new Set(entries.map(([, path]) => path))])
      .then((byPath) => {
        if (cancelled) return;
        const byId: Record<string, string> = {};
        for (const [id, path] of entries) if (byPath[path]) byId[id] = byPath[path];
        setUrls(byId);
      })
      .catch(() => {
        // Sem a foto a carta continua jogável (só aparece sem imagem); a próxima mudança tenta de novo.
      });
    return () => {
      cancelled = true;
    };
  }, [key, round]);

  return urls;
}
