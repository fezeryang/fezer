export interface Position {
  x: number;
  y: number;
}

export interface PetDimensions {
  width: number;
  height: number;
}

export interface PetState {
  isVisible: boolean;
  position: Position;
}

export interface WebPetHookReturn {
  isVisible: boolean;
  toggleVisibility: () => void;
}

export interface SpeechBubbleMessage {
  id: string;
  text: string;
  timestamp: number;
}
