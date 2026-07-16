import { ModuleScene } from "../ModuleScene";
import { SceneMetronomo } from "@/components/showcase/scenes";

export function Metronomo() {
  return (
    <ModuleScene
      badge="Metrônomo Inteligente"
      title={
        <>
          Foco que{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF]">
            não falha
          </span>
          .
        </>
      }
      subtitle="Envie sua música e o BPM é detectado direto do áudio — pronto para o ensaio."
      phoneIndex={3}
    >
      <SceneMetronomo />
    </ModuleScene>
  );
}
