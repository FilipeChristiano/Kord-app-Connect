import { ModuleScene } from "../ModuleScene";
import { SceneAudioLab } from "@/components/showcase/scenes";

export function AudioLab() {
  return (
    <ModuleScene
      badge="Audio Lab Nativo"
      title={
        <>
          A mágica acontece{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF]">aqui</span>.
        </>
      }
      subtitle="Qualquer música vira cifra pronta em segundos — com tom ajustável e sofisticação em um clique. E ainda: voz e instrumental isolados na hora."
      phoneIndex={2}
    >
      <SceneAudioLab />
    </ModuleScene>
  );
}
