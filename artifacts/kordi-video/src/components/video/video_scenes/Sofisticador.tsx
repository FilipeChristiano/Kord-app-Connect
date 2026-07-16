import { ModuleScene } from "../ModuleScene";
import { SceneSofisticador } from "@/components/showcase/scenes";

export function Sofisticador() {
  return (
    <ModuleScene
      badge="Sofisticador de Cifra"
      title={
        <>
          Saia do{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C24BF7] to-[#9673FF]">básico</span>.
        </>
      }
      subtitle="Escolha o nível e o Kordi reescreve os acordes na hora — a letra fica intacta."
      phoneIndex={0}
    >
      <SceneSofisticador />
    </ModuleScene>
  );
}
