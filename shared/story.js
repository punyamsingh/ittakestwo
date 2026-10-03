// Story beats for Chapter 1. `may` / `cody` lines are spoken by whichever
// player is playing that doll; the UI adds "(you)" and their portrait.

export const SPEAKERS = {
  narrator: { name: 'Narrator', color: '#7a5a3c' },
  hakim: { name: 'Dr. Hakim', color: '#c8323c' },
  rose: { name: 'Rose', color: '#d9578f' },
  toolbox: { name: 'The Toolbox', color: '#d9452f' },
};

export const STORY = {
  awakening: {
    before: [
      ['narrator', 'Cody and May had agreed on one last thing: the divorce. All that was left was telling Rose.'],
      ['rose', 'If I can’t fix it… maybe the book can. Please, Dr. Hakim. Make Mom and Dad friends again.'],
      ['narrator', 'A single tear fell on two little dolls — one carved from wood, one shaped from clay.'],
      ['may', 'Cody? Why are you… tiny? Why am I wooden?!'],
      ['cody', 'Why am I made of CLAY?'],
      ['hakim', '¡Hola, amigos! I am Dr. Hakim, the Book of Love — and you two have a lot of homework.'],
      ['hakim', 'Your daughter has tied you together with her little red thread. Where one goes, the other follows!'],
      ['may', 'We need to get back to Rose. Now.'],
      ['cody', 'Then I guess we’re walking. Together.'],
    ],
    after: [
      ['hakim', 'You see? The thread pulls — but it also catches. Remember that, mis amigos.'],
      ['cody', 'It pulled me off a shelf.'],
      ['may', 'And it pulled you back up.'],
    ],
  },
  'broken-bridge': {
    before: [
      ['may', 'Your workbench. You said you’d finish these projects years ago.'],
      ['cody', 'I was busy. Raising our daughter, remember?'],
      ['hakim', 'Ay, ay, ay. Less arguing, more cooperating! The machines only move when you both push the buttons.'],
    ],
    after: [
      ['cody', 'Huh. My old contraptions actually work.'],
      ['may', 'Some of them. The rest is held together with tape.'],
      ['hakim', 'Like many marriages! Onward!'],
    ],
  },
  'windward-cliffs': {
    before: [
      ['narrator', 'A pane in the shed window had been cracked for years. Today, the wind came through it howling.'],
      ['may', 'I asked you to fix that window. Three summers ago.'],
      ['cody', 'And I asked you to be home for dinner. Guess we’re even.'],
      ['hakim', 'Hold on to each other — literally! When the draft blows, one of you must BRACE.'],
    ],
    after: [
      ['may', '…Thanks for holding on back there.'],
      ['cody', 'Didn’t have much choice. But you’re welcome.'],
    ],
  },
  'stormfall-ascent': {
    before: [
      ['narrator', 'High above, the old shelves groaned. Screws and bolts began to rain from the rafters.'],
      ['hakim', 'Love is like a shed full of loose screws — it needs a little tightening now and then!'],
      ['cody', 'Did he just make that up?'],
      ['may', 'Just run.'],
    ],
    after: [
      ['hakim', 'Every heart you gathered is a little memory you two made together. Keep them close.'],
      ['may', 'I’d forgotten about most of them.'],
    ],
  },
  'spire-gate': {
    before: [
      ['narrator', 'Past the fuse box, the shed door — and the long way back to Rose.'],
      ['may', 'Buttons, lifts, springs, wind. Everything, at once.'],
      ['cody', 'We’ve done every one of them already. We can do it again.'],
      ['hakim', 'Now THAT is the spirit of teamwork! I could weep. In fact, I am weeping. Onward!'],
    ],
    after: [
      ['narrator', 'Something heavy shifted in the dark beneath the workbench. Something with a handle… and a grudge.'],
    ],
  },
  'iron-warden': {
    before: [
      ['toolbox', 'CODY. You LEFT me OUT in the RAIN.'],
      ['cody', 'That was one time!'],
      ['toolbox', 'TWELVE times. My hinges SQUEAK.'],
      ['hakim', 'The old power cord still sparks! Stand on BOTH buttons at once and give this grumpy box a jolt!'],
      ['may', 'Together, then.'],
      ['cody', 'Together.'],
    ],
    after: [
      ['toolbox', 'Fine… FINE. Go. Just… oil my hinges sometime.'],
      ['hakim', '¡Magnífico! The shed is behind you — but the road home to Rose is long, mis amigos.'],
      ['may', 'We’re still not fixed, Cody.'],
      ['cody', 'No. But we got out of the shed.'],
      ['narrator', 'End of Chapter One — The Shed.'],
    ],
  },
};
