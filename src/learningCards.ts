export interface LearningCard {
  levelId: string;
  subject: string;
  prompt: string;
  answer: string;
}

export const LEARNING_CARDS: LearningCard[] = [
  { levelId: 'forest-1', subject: 'Forest', prompt: 'What connects every organism in a food web?', answer: 'Energy moves through the web as organisms eat plants or other organisms.' },
  { levelId: 'forest-2', subject: 'Forest', prompt: 'Why are pollinators important?', answer: 'They carry pollen between flowers, helping many plants make seeds and fruit.' },
  { levelId: 'forest-3', subject: 'Forest', prompt: 'How do forest layers help wildlife?', answer: 'The canopy, understory, and floor provide different food, shelter, light, and moisture.' },
  { levelId: 'workshop-1', subject: 'Machines', prompt: 'What does a lever change?', answer: 'A lever trades distance for force, making a load easier to move.' },
  { levelId: 'workshop-2', subject: 'Machines', prompt: 'Why do gears use different sizes?', answer: 'Different gear sizes change rotational speed, direction, and turning force.' },
  { levelId: 'workshop-3', subject: 'Machines', prompt: 'What is an energy transfer?', answer: 'It is energy moving from one object or form to another, such as heat making steam move.' },
  { levelId: 'word-1', subject: 'Language', prompt: 'What does a letter represent?', answer: 'A letter is a written symbol that commonly represents one or more speech sounds.' },
  { levelId: 'word-2', subject: 'Language', prompt: 'What makes two words rhyme?', answer: 'Their ending sounds match or sound very similar, even when their spelling differs.' },
  { levelId: 'word-3', subject: 'Language', prompt: 'Why does punctuation matter?', answer: 'Punctuation groups ideas and shows readers when to pause, stop, ask, or exclaim.' },
  { levelId: 'number-1', subject: 'Numbers', prompt: 'What is a number pattern?', answer: 'It is a sequence built by repeating a predictable rule.' },
  { levelId: 'number-2', subject: 'Numbers', prompt: 'What does a fraction describe?', answer: 'A fraction describes equal parts of one whole or equal parts of a group.' },
  { levelId: 'number-3', subject: 'Logic', prompt: 'What makes a conclusion logical?', answer: 'It follows consistently from the facts and rules that came before it.' },
  { levelId: 'space-1', subject: 'Space', prompt: 'Why do objects fall toward a moon?', answer: 'Mass creates gravity, which pulls other masses toward it.' },
  { levelId: 'space-2', subject: 'Space', prompt: 'Why does a satellite stay in orbit?', answer: 'It moves sideways while gravity continually bends its path around a larger body.' },
  { levelId: 'space-3', subject: 'Space', prompt: 'What is a nebula?', answer: 'A nebula is a vast cloud of gas and dust where stars may form or leave material behind.' },
  { levelId: 'music-1', subject: 'Music', prompt: 'What is a musical beat?', answer: 'The beat is the steady pulse used to organise sounds in time.' },
  { levelId: 'music-2', subject: 'Music', prompt: 'How is harmony created?', answer: 'Harmony happens when different pitches sound together in a pleasing or purposeful way.' },
  { levelId: 'music-3', subject: 'Music', prompt: 'What does a conductor communicate?', answer: 'A conductor guides tempo, entrances, dynamics, and expression with visible gestures.' },
];
