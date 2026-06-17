"use client";

import { useServerInsertedHTML } from "next/navigation";

const MOTION_INIT = `(function(){try{if(localStorage.getItem('ypp-motion-pref')==='on'){document.documentElement.setAttribute('data-motion','on');}}catch(e){}})();`;

/** SSR-only motion bootstrap — injected outside the client React tree (React 19 safe). */
export function MotionInitScript() {
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: MOTION_INIT }} />
  ));
  return null;
}
