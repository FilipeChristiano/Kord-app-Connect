import { ModuleScene } from "../ModuleScene";
import { ScenePad } from "@/components/showcase/scenes";

export function Pads() {
  return (
    <ModuleScene
      badge="Pad Worship Contínuo"
      title={
        <>
          Sustentação{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF]">
            infinita
          </span>
          .
        </>
      }
      subtitle="Pads contínuos em todos os tons para cobrir os silêncios do louvor."
      phoneIndex={4}
    >
      <ScenePad />
    </ModuleScene>
  );
}
