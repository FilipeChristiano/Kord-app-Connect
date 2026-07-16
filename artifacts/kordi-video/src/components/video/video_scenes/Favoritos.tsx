import { ModuleScene } from "../ModuleScene";
import { SceneFavoritos } from "@/components/showcase/scenes";

export function Favoritos() {
  return (
    <ModuleScene
      badge="Seu repertório"
      title={
        <>
          Tudo{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF]">à mão</span>.
        </>
      }
      subtitle="Suas músicas salvas com tom e BPM, prontas para o ao vivo."
      phoneIndex={5}
    >
      <SceneFavoritos />
    </ModuleScene>
  );
}
