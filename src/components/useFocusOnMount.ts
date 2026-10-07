import { useEffect, useRef } from "react";

// 画面を差し替えたとき、キーボード・支援技術の利用者が迷わないよう要素にフォーカスを移す
export function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
