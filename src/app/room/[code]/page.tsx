import { Suspense } from "react";
import RoomScreen from "@/components/RoomScreen";

export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-dusk" />}>
      <Room params={props.params} />
    </Suspense>
  );
}

async function Room({ params }: { params: PageProps<"/room/[code]">["params"] }) {
  const { code } = await params;
  return <RoomScreen code={code.toUpperCase()} />;
}
