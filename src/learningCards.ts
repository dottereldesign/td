import { STARTER_CARD_ART } from './collectionAssets';
import type { WorldId } from './types';

export type LearningCardFinish = 'standard' | 'holographic';
export type LearningCardRarity = 'Starter' | 'Uncommon' | 'Rare' | 'Mythic';

interface LearningCardDetails {
  id: string;
  world: WorldId;
  name: string;
  subject: string;
  prompt: string;
  answer: string;
  toughness: number;
  defense: number;
  rarity: LearningCardRarity;
  finish: LearningCardFinish;
  accent: string;
}

export interface StarterLearningCard extends LearningCardDetails {
  starter: true;
  art: string;
}

export interface LearningCard extends LearningCardDetails {
  levelId: string;
}

export type CollectionCard = StarterLearningCard | LearningCard;

export const STARTER_CARDS: StarterLearningCard[] = [
  {
    id: 'verdant-webkeeper',
    world: 'forest',
    name: 'Verdant Webkeeper',
    subject: 'Ecosystems',
    prompt: 'What do decomposers return to an ecosystem?',
    answer: 'They break down dead matter and return nutrients to soil and water for living things to use again.',
    toughness: 72,
    defense: 81,
    rarity: 'Starter',
    finish: 'standard',
    accent: '#72dc4b',
    starter: true,
    art: STARTER_CARD_ART['verdant-webkeeper'],
  },
  {
    id: 'fulcrum-forgeback',
    world: 'workshop',
    name: 'Fulcrum Forgeback',
    subject: 'Simple machines',
    prompt: 'How can a lever lift a heavy load?',
    answer: 'A longer lever arm lets a smaller force move the load through a greater distance.',
    toughness: 86,
    defense: 74,
    rarity: 'Starter',
    finish: 'standard',
    accent: '#f0a43a',
    starter: true,
    art: STARTER_CARD_ART['fulcrum-forgeback'],
  },
  {
    id: 'runequill-griffin',
    world: 'word',
    name: 'Runequill Griffin',
    subject: 'Language',
    prompt: 'What is a syllable?',
    answer: 'A syllable is one beat of sound in a word, built around a vowel sound.',
    toughness: 63,
    defense: 84,
    rarity: 'Starter',
    finish: 'standard',
    accent: '#a566ff',
    starter: true,
    art: STARTER_CARD_ART['runequill-griffin'],
  },
  {
    id: 'sequence-sprite',
    world: 'number',
    name: 'Sequence Sprite',
    subject: 'Patterns',
    prompt: 'How can you predict what comes next in a pattern?',
    answer: 'Find the rule that repeats or changes, then apply the same rule to the next step.',
    toughness: 77,
    defense: 77,
    rarity: 'Mythic',
    finish: 'holographic',
    accent: '#70e9ff',
    starter: true,
    art: STARTER_CARD_ART['sequence-sprite'],
  },
];

export const LEARNING_CARDS: LearningCard[] = [
  { id: 'forest-1', levelId: 'forest-1', world: 'forest', name: 'Golden Threadkeeper', subject: 'Forest', prompt: 'What connects every organism in a food web?', answer: 'Energy moves through the web as organisms eat plants or other organisms.', toughness: 76, defense: 68, rarity: 'Uncommon', finish: 'standard', accent: '#72dc4b' },
  { id: 'forest-2', levelId: 'forest-2', world: 'forest', name: 'Pollenwing Courier', subject: 'Forest', prompt: 'Why are pollinators important?', answer: 'They carry pollen between flowers, helping many plants make seeds and fruit.', toughness: 58, defense: 71, rarity: 'Uncommon', finish: 'standard', accent: '#72dc4b' },
  { id: 'forest-3', levelId: 'forest-3', world: 'forest', name: 'Canopy Crownwarden', subject: 'Forest', prompt: 'How do forest layers help wildlife?', answer: 'The canopy, understory, and floor provide different food, shelter, light, and moisture.', toughness: 84, defense: 88, rarity: 'Rare', finish: 'standard', accent: '#72dc4b' },
  { id: 'workshop-1', levelId: 'workshop-1', world: 'workshop', name: 'Leverback Apprentice', subject: 'Machines', prompt: 'What does a lever change?', answer: 'A lever trades distance for force, making a load easier to move.', toughness: 82, defense: 72, rarity: 'Uncommon', finish: 'standard', accent: '#f0a43a' },
  { id: 'workshop-2', levelId: 'workshop-2', world: 'workshop', name: 'Cogwheel Quickclaw', subject: 'Machines', prompt: 'Why do gears use different sizes?', answer: 'Different gear sizes change rotational speed, direction, and turning force.', toughness: 69, defense: 78, rarity: 'Uncommon', finish: 'standard', accent: '#f0a43a' },
  { id: 'workshop-3', levelId: 'workshop-3', world: 'workshop', name: 'Steamheart Colossus', subject: 'Machines', prompt: 'What is an energy transfer?', answer: 'It is energy moving from one object or form to another, such as heat making steam move.', toughness: 91, defense: 87, rarity: 'Rare', finish: 'standard', accent: '#f0a43a' },
  { id: 'word-1', levelId: 'word-1', world: 'word', name: 'Glyphwing Scribe', subject: 'Language', prompt: 'What does a letter represent?', answer: 'A letter is a written symbol that commonly represents one or more speech sounds.', toughness: 62, defense: 80, rarity: 'Uncommon', finish: 'standard', accent: '#a566ff' },
  { id: 'word-2', levelId: 'word-2', world: 'word', name: 'Rhymebell Songfox', subject: 'Language', prompt: 'What makes two words rhyme?', answer: 'Their ending sounds match or sound very similar, even when their spelling differs.', toughness: 66, defense: 73, rarity: 'Uncommon', finish: 'standard', accent: '#a566ff' },
  { id: 'word-3', levelId: 'word-3', world: 'word', name: 'Punctuation Paladin', subject: 'Language', prompt: 'Why does punctuation matter?', answer: 'Punctuation groups ideas and shows readers when to pause, stop, ask, or exclaim.', toughness: 79, defense: 91, rarity: 'Rare', finish: 'standard', accent: '#a566ff' },
  { id: 'number-1', levelId: 'number-1', world: 'number', name: 'Patternstep Pixie', subject: 'Numbers', prompt: 'What is a number pattern?', answer: 'It is a sequence built by repeating a predictable rule.', toughness: 70, defense: 76, rarity: 'Uncommon', finish: 'standard', accent: '#70e9ff' },
  { id: 'number-2', levelId: 'number-2', world: 'number', name: 'Fraction Forgeguard', subject: 'Numbers', prompt: 'What does a fraction describe?', answer: 'A fraction describes equal parts of one whole or equal parts of a group.', toughness: 83, defense: 82, rarity: 'Uncommon', finish: 'standard', accent: '#70e9ff' },
  { id: 'number-3', levelId: 'number-3', world: 'number', name: 'Logic Prism Oracle', subject: 'Logic', prompt: 'What makes a conclusion logical?', answer: 'It follows consistently from the facts and rules that came before it.', toughness: 74, defense: 93, rarity: 'Rare', finish: 'standard', accent: '#70e9ff' },
  { id: 'space-1', levelId: 'space-1', world: 'space', name: 'Gravity Moonling', subject: 'Space', prompt: 'Why do objects fall toward a moon?', answer: 'Mass creates gravity, which pulls other masses toward it.', toughness: 78, defense: 84, rarity: 'Uncommon', finish: 'standard', accent: '#5797ff' },
  { id: 'space-2', levelId: 'space-2', world: 'space', name: 'Orbitwing Voyager', subject: 'Space', prompt: 'Why does a satellite stay in orbit?', answer: 'It moves sideways while gravity continually bends its path around a larger body.', toughness: 73, defense: 86, rarity: 'Uncommon', finish: 'standard', accent: '#5797ff' },
  { id: 'space-3', levelId: 'space-3', world: 'space', name: 'Nebula Starwhale', subject: 'Space', prompt: 'What is a nebula?', answer: 'A nebula is a vast cloud of gas and dust where stars may form or leave material behind.', toughness: 90, defense: 90, rarity: 'Rare', finish: 'standard', accent: '#5797ff' },
  { id: 'music-1', levelId: 'music-1', world: 'music', name: 'Beatkeeper Drumkin', subject: 'Music', prompt: 'What is a musical beat?', answer: 'The beat is the steady pulse used to organise sounds in time.', toughness: 75, defense: 69, rarity: 'Uncommon', finish: 'standard', accent: '#f05fd4' },
  { id: 'music-2', levelId: 'music-2', world: 'music', name: 'Harmony Hummingbird', subject: 'Music', prompt: 'How is harmony created?', answer: 'Harmony happens when different pitches sound together in a pleasing or purposeful way.', toughness: 64, defense: 81, rarity: 'Uncommon', finish: 'standard', accent: '#f05fd4' },
  { id: 'music-3', levelId: 'music-3', world: 'music', name: 'Tempo Batonmaster', subject: 'Music', prompt: 'What does a conductor communicate?', answer: 'A conductor guides tempo, entrances, dynamics, and expression with visible gestures.', toughness: 81, defense: 89, rarity: 'Rare', finish: 'standard', accent: '#f05fd4' },
];
