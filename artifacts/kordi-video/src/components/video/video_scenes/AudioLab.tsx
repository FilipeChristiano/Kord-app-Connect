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
      subtitle="O Kordi baixa a música, isola a voz e o instrumental — e você ouve o resultado na hora."
      phoneIndex={2}
    >
      <SceneAudioLab />
    </ModuleScene>
  );
}
