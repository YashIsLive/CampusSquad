import { Suspense } from "react";
import { FinishClient } from "./finish-client";

export default function AuthFinishPage() {
  return (
    <Suspense>
      <FinishClient />
    </Suspense>
  );
}
