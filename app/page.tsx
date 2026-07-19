import { DentalTalkApp } from "@/components/DentalTalkApp";
import { getTtsProvider } from "@/lib/tts-provider";
import { getTranslationPipelineMode } from "@/lib/translation-pipeline";

export default function Home() {
  return (
    <DentalTalkApp
      pipelineMode={getTranslationPipelineMode()}
      ttsProvider={getTtsProvider()}
    />
  );
}
