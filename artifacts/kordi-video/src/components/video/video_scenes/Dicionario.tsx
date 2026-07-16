import { ModuleScene } from "../ModuleScene";
import { SceneAcordes } from "@/components/showcase/scenes";

export function Dicionario() {
  return (
    <ModuleScene
      badge="Dicionário Vivo"
      title={
        <>
          Veja e ouça{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF]">
            cada acorde
          </span>
          .
        </>
      }
      subtitle="Diagramas de piano de verdade, com fórmula, aplicação e som real."
      phoneIndex={1}
    >
      <SceneAcordes />
    </ModuleScene>
  );
}
