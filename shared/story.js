// Story beats for Chapter 1. `p1` / `p2` lines are spoken by the players' own
// creatures (host / guest); the UI swaps in their creature name and colour.

export const SPEAKERS = {
  narrator: { name: 'The Chronicle', color: '#f1e0c8' },
  aeris: { name: 'Aeris, Spirit of the Spire', color: '#a8c4ff' },
  vorrak: { name: 'Vorrak the Unbound', color: '#ff5d6c' },
  warden: { name: 'The Iron Warden', color: '#ffb35c' },
};

export const STORY = {
  awakening: {
    before: [
      ['narrator', 'Above the storm-sea drifted Aerth, the Sky Kingdom — and at its heart rose the World Spire, crowned by the Heartstone.'],
      ['narrator', 'Two guardians kept its light. Where one stood, the other was never far behind.'],
      ['vorrak', 'Guardians. You were always strongest together.'],
      ['vorrak', 'So I have made certain that you will FALL together.'],
      ['narrator', 'With the Heartstone shattered and the kingdom torn apart, Vorrak bound the guardians with the cursed Oathchain and cast them down.'],
      ['aeris', 'Wake up, you two. The Oathchain cannot be cut… but it can be broken — at the summit of the Spire.'],
      ['p1', 'Then we climb.'],
      ['p2', '…Together, apparently.'],
    ],
    after: [
      ['aeris', 'The chain drags, but it also holds. Remember that.'],
      ['p2', 'I remember it pulling me off a cliff.'],
      ['p1', 'And pulling you back.'],
    ],
  },
  'broken-bridge': {
    before: [
      ['aeris', 'The Great Bridge once joined these isles. The storm broke it — but the old ferries still run.'],
      ['vorrak', 'Run, little guardians. Every step you take, I feel through the chain.'],
      ['p1', 'He can feel us?'],
      ['p2', 'Then let’s give him something to feel.'],
    ],
    after: [
      ['aeris', 'The machines answered you. They remember their guardians, even if the kingdom has forgotten.'],
    ],
  },
  'windward-cliffs': {
    before: [
      ['aeris', 'The Windward Cliffs. Vorrak commands the gales here — they will try to tear you apart.'],
      ['p2', 'Good luck to them. This chain doesn’t come off.'],
      ['vorrak', 'Bend, break, or fall. The wind does not care which.'],
    ],
    after: [
      ['p1', 'The Spire… it’s closer than it looks.'],
      ['aeris', 'And angrier. Look to the sky.'],
    ],
  },
  'stormfall-ascent': {
    before: [
      ['narrator', 'As the guardians climbed, the sky split open. Fragments of the shattered Heartstone fell burning from the clouds.'],
      ['vorrak', 'You want the Heartstone? Then HAVE it.'],
      ['p1', 'Stay close.'],
      ['p2', 'Not like I have a choice.'],
    ],
    after: [
      ['aeris', 'Each shard you gathered hums with its old light. The Heartstone is not lost — only scattered.'],
    ],
  },
  'spire-gate': {
    before: [
      ['aeris', 'The Spire Gate. Beyond it waits the Warden — Vorrak’s iron sentinel, forged from the kingdom’s own guardians’ armor.'],
      ['p1', 'Our armor?'],
      ['vorrak', 'Everything you were belongs to me now.'],
      ['p2', 'Then we’re taking it back.'],
    ],
    after: [
      ['narrator', 'The Gate groaned open. Something vast stirred in the arena beyond.'],
    ],
  },
  'iron-warden': {
    before: [
      ['warden', 'GUARDIANS. DETECTED. PROTOCOL: CONTAINMENT.'],
      ['aeris', 'Its core is sealed! Stand on the twin runes together — the Spire’s lightning will answer only both of you at once.'],
      ['p1', 'Together, then.'],
      ['p2', 'Always.'],
    ],
    after: [
      ['warden', 'CONTAINMENT… FAILED…'],
      ['narrator', 'The Warden fell, and from its broken core rose the first shard of the Heartstone.'],
      ['aeris', 'One shard of seven. The Oathchain loosens — barely.'],
      ['vorrak', 'Enjoy your little victory. The Spire is tall, guardians… and I am waiting at the top.'],
      ['narrator', 'End of Chapter One — The Shattered Isles.'],
    ],
  },
};
