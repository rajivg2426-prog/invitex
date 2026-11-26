/* English phrase bank for the InviteX built-in writer (js/copy/engine.js).
 * Hand-written. Tags: @group (love home sacred gather party work; style lines default
 * to every group except work), ~tone (warm refined bright devout), #idea (an idea may
 * appear only once per version), !tradition. Tokens: {names} {host} {title} {occ} {god} {city} {event}.
 * Host lines use "would / will" so they read correctly for one host or many. */
(function (root) {
  'use strict';
  const B = {};
  B.occ = {
    wedding: 'wedding', engagement: 'engagement', anniversary: 'anniversary', birthday: 'birthday celebration',
    housewarming: 'housewarming', religious: 'puja', festival: 'family celebration', community: 'community gathering',
    corporate: 'meeting', conference: 'conference', launch: 'launch', school: 'celebration', farewell: 'farewell', custom: 'celebration',
  };
  B.tradition = {
    hindu: { invoke: '॥ Shree Ganeshaya Namah ॥', god: 'the Almighty' },
    sikh: { invoke: 'ੴ Ik Onkar Satgur Prasad', god: 'Waheguru' },
    jain: { invoke: '॥ Namo Arihantanam ॥', god: 'the Tirthankaras' },
    muslim: { invoke: 'Bismillah ir-Rahman ir-Rahim', god: 'Allah' },
    christian: { invoke: 'By the grace of God', god: 'God' },
  };

  B.style = {
    elegant: {
      top: ['An invitation, with love', ['A celebration of two families', '@love #family'], ['A new door opens', '@home #home'], ['An evening in their honour', '@party'], ['A gathering of kindred spirits', '@gather'], ['In quiet celebration', '@sacred'],
        ['An invitation to an evening of ideas', '@work'], ['With the compliments of {host}', '@work']],
      sub: [['invite you to share the day they become one', '@love #together'], ['would be glad of your company as they celebrate', '@love'], ['ask you to join them for an evening of grace', '@love'],
        ['You are invited to the {occ}', '@home @sacred @gather @party'], ['An occasion made finer by your company', '@home @sacred @gather @party'],
        ['You are invited to the {occ}', '@work'], ['An occasion for thoughtful conversation', '@work']],
      open: ['Some moments ask to be shared with the right people.', ['There are days that quietly change everything, and this is one of them.', '#journey'], 'We have been looking forward to this for a long time.'],
      invite: ['{host} would be delighted to welcome you.', ['It would give us great pleasure to have you with us for the {occ}.', ''], 'We would be honoured if you could join us.', ['{host} would be glad to receive you at the {occ}.', ''],
        ['{host} would be pleased to welcome you to {title}.', '@work'], ['We would be glad to have you with us for the {occ}.', '@work']],
      close: ['We hope you will be there.', 'An evening is only as lovely as the people in it, and we would like you to be among them.', ['We will keep a place for you.', ''],
        ['We would value your presence and your perspective.', '@work'], ['We hope you can make the time to be with us.', '@work']],
      thanks: ['With sincere thanks for your kindness and your company.', ['Thank you for being part of the occasion.', ''], ['With warm regards and gratitude.', '@work #gratitude'], ['Thank you for your time; it is much appreciated.', '@work']],
    },
    heartfelt: {
      top: [['With full hearts', '#heart'], ['Because you are part of our story', '#memory'], ['Love brought us here', '@love'], ['Home, at last', '@home #home'], ['From our hearts to yours', '#heart'],
        ['With heartfelt thanks', '@work #gratitude'], ['Because we did this together', '@work #together']],
      sub: [['would love you beside them as they begin their life together', '@love #journey'], ['want the people they love most to witness this day', '@love'],
        ['Our hearts would be fuller with you there', '@home @sacred @gather @party #heart'], ['Please come and share this day with us', '@home @sacred @gather @party'],
        ['A moment of thanks, and an invitation', '@work #gratitude'], ['You are part of this milestone', '@work']],
      open: [['Some of the best chapters of our life have been written with you in them.', '#memory'], ['We have thought about who we want around us on this day, and you came to mind at once.'], ['Life keeps its sweetest moments for the people we love.', '#heart']],
      invite: ['{host} would truly love to have you there.', 'It would mean a great deal to us if you came.', ['Please come and celebrate the {occ} with us.', ''],
        ['We would be grateful to have you with us for {title}.', '@work #gratitude'], ['{host} would be glad to share this milestone with you.', '@work']],
      close: [['Your being there will stay with us long after the day is over.', '#memory'], 'Come as you are; that is all we hope for.', ['We cannot imagine the day without you.', ''],
        ['None of this would have happened without people like you.', '@work #gratitude'], ['We hope you can be part of the moment.', '@work']],
      thanks: [['Thank you for the love you have given us over the years.', '#heart'], ['Thank you, from all of us, for being part of our lives.', '#family'], ['Thank you for walking this road with us.', '@work #journey'], ['With heartfelt thanks for your support.', '@work #gratitude']],
    },
    royal: {
      top: [['With the blessings of our ancestors', '@love @home @sacred @gather #bless'], ['A royal celebration', '@love @party @gather'], ['By royal invitation', '@love @party @home'], ['In grand celebration', '@love @gather @party'],
        ['A gala evening', '@work'], ['By special invitation', '@work']],
      sub: [['request the honour of your presence at their wedding', '@love #honour'], ['invite you to a celebration of grandeur and tradition', '@love'], ['solicit your gracious company at the festivities', '@love'],
        ['The honour of your presence is requested', '@home @sacred @gather @party #honour'], ['A grand {occ} awaits you', '@home @gather @party'],
        ['The honour of your presence is requested at {title}', '@work #honour'], ['An evening of distinction', '@work']],
      open: [['As lamps are lit and music fills the courtyard, the celebrations begin.', '@love @gather @home'], ['Tradition, music and splendour come together for one unforgettable occasion.', '@love @gather @party']],
      invite: [['The honour of your gracious presence is requested by {host}.', '#honour'], ['The family would be honoured to receive you at the {occ}.', '#honour'], ['{host} will receive you with every courtesy.', ''],
        ['{host} would be honoured to receive you at {title}.', '@work #honour'], ['You are invited to an evening befitting the occasion.', '@work']],
      close: [['Your presence will lend the occasion its true grandeur.', '#presence'], ['Let us celebrate in the grand manner the day deserves.'], ['The festivities await your arrival.'],
        ['We look forward to receiving you in style.', '@work'], ['An evening of fine company and celebration awaits.', '@work']],
      thanks: [['With deepest gratitude for your gracious presence.', '#gratitude'], ['Your company is the jewel of the occasion.', '#presence'], ['With our compliments and thanks.', '@work #gratitude'], ['Thank you for honouring us with your presence.', '@work #presence']],
    },
    traditional: {
      top: [['With the blessings of our elders', '#bless'], ['Shubh Vivah', '@love'], ['With the good wishes of the whole family', '#family'], ['Shubh Aagman', '@home @sacred @gather'], ['An auspicious beginning', '@love @home'], ['By the grace of {god}', '#divine'], ['With the blessings of our family deity', '!hindu #divine'], ['Om Shanti', '!hindu @sacred @home'], ['With folded hands', '#welcome']],
      sub: [['seek your blessings as they begin their married life', '@love #bless'], ['will be united in marriage, and the family requests your presence', '@love #presence'], ['begin their journey together, and you are invited to witness it', '@love #journey'], ['invite you and your family to their auspicious {occ}', '@love'],
        ['You and your family are invited to the auspicious {occ}', '@home @sacred @gather @party'], ['Your blessings are sought on this auspicious day', '@home @sacred @gather @party #bless']],
      open: [['On this auspicious day, our family follows the customs passed down to us.', '#family'], ['As our elders taught us, joy is complete only when it is shared.']],
      invite: [['{host} would be honoured if you and your family graced the {occ}.', ''], ['We humbly invite you and your family to be with us.', '#family'], ['Kindly grace the {occ} with your presence.', '#presence']],
      close: [['Your blessings will mean everything to the family.', '#bless'], ['Please come with your family and make the occasion auspicious.', '#family'], 'We await you with folded hands.'],
      thanks: [['With respect and gratitude to every elder and well-wisher.', '#gratitude'], ['May the blessings you bring stay with the family always.', '#bless'], ['Dhanyavaad for your affection and blessings.', '#bless']],
    },
    spiritual: {
      top: [['By the grace of {god}', '#divine'], ['॥ Om ॥', '!hindu'], ['ੴ Satnam', '!sikh'], ['In a spirit of prayer', '#divine'], ['With faith and gratitude', '#gratitude']],
      sub: [['seek the blessings of {god} as they begin a sacred union', '@love #divine'], ['invite you to a sacred beginning', '@love'],
        ['Join us in prayer and devotion', '@home @sacred @gather @party'], ['An invitation to a day of devotion', '@home @sacred @gather']],
      open: [['When we gather in faith, the day itself becomes a prayer.', '#divine'], ['Every good beginning starts with gratitude.', '#gratitude'], ['We begin this day in prayer, as our family always has.', '#divine']],
      invite: [['{host} would humbly ask you to join the prayers.', ''], ['We invite you to share in the devotion and the peace of the {occ}.', ''], ['Please come and receive the blessings of the day with us.', '#bless']],
      close: [['May the peace of this day stay with you and your family.', ''], ['Come, and let us pray together.', ''], ['May {god} bless all who gather with us.', '#divine']],
      thanks: [['May {god} keep you and your family in good health and peace.', '#divine'], ['With prayers for your well-being.', ''], ['Thank you for joining us in faith.', '#gratitude']],
    },
    modern: {
      top: ['You are invited', ['Two names. One date.', '@love'], ['New address, open door', '@home #home'], ['Mark the date', '@party @gather'], ['One day. One room.', '@work'], ['Be there', '@work']],
      sub: [['are getting married. You should be there.', '@love'], ['invite you to celebrate, simply and beautifully', '@love'],
        ['A {occ}, and you are on the list', '@home @gather @party'], ['Come for the occasion, stay for the company', '@home @gather @party'],
        ['{title}: be in the room', '@work'], ['An invitation to {title}', '@work']],
      open: ['Short and simple: we are celebrating.', ['Here is the plan.', '']],
      invite: ['{host} would love to see you there.', ['Join us for the {occ}.', ''], 'Come along. It will be good.',
        ['Join us for {title}.', '@work'], ['{host} would like to see you at the {occ}.', '@work']],
      close: ['That is all you need to know. See you soon.', 'Bring yourself; we will take care of the rest.', ['Reply below so we can plan.', ''],
        ['Clear agenda, good people, time well spent.', '@work'], ['Register below to confirm your place.', '@work']],
      thanks: ['Thank you. Until then.', 'Thanks for making the time.', ['Thanks; see you in the room.', '@work'], ['Thank you for registering.', '@work']],
    },
    joyful: {
      top: [['Let the celebrations begin!', '#joy'], ['Good news travels fast!', ''], ['Something wonderful is happening', ''], ['Dhol, lights and laughter', '@love @gather'],
        ['Big news, bigger celebration', '@work'], ['Something new is on its way', '@work']],
      sub: [['are getting married, and the party starts with you!', '@love #joy'], ['want you dancing at their celebration', '@love'],
        ['Come and celebrate with us!', '@home @sacred @gather @party'], ['A day full of music, food and laughter', '@home @gather @party #joy'],
        ['Come and celebrate {title} with us!', '@work'], ['Be part of the big reveal', '@work']],
      open: [['There is music in the air and smiles all around.', '#joy'], ['Happy news, the best kind!']],
      invite: ['{host} cannot wait to celebrate with you!', ['Come and make the {occ} even brighter!', ''], ['Bring your best smile and your dancing shoes!', '#joy'],
        ['{host} would love you to join the celebration!', '@work'], ['Come and see what we have been building!', '@work']],
      close: ['It is going to be a day to treasure, and it starts with you!', 'Get ready for food, music and plenty of laughter!', ['See you on the dance floor!', '@love @party @gather'],
        ['Expect energy, ideas and a great time!', '@work'], ['See you at the celebration!', '@work']],
      thanks: [['Thank you for adding to the joy!', '#joy'], ['Thank you for every smile you bring!', ''], ['Thank you for being part of the excitement!', '@work'], ['Thanks for celebrating with us!', '@work']],
    },
    friendly: {
      top: ['Hello, friend!', ['Guess what?', ''], ['Pull up a chair', '@home @gather @party'], ['Hey there!', '@party'], ['Hello, team!', '@work'], ['A quick invite', '@work']],
      sub: [['would love to see you at their wedding', '@love'], ['are celebrating, and you are invited', '@love'],
        ['You are invited, and we really hope you can make it', '@home @sacred @gather @party'], ['Come over and celebrate with us', '@home @gather @party'],
        ['You are invited to {title}', '@work'], ['Come and join us', '@work']],
      open: [['We are doing something special and it would not feel right without you.', ''], ['You have been on our list since the day we started planning.', '#memory']],
      invite: ['{host} would really love to see you there.', ['Do come for the {occ}; it will be lovely to catch up.', ''], ['Come along, bring your family, and stay as long as you like.', '#family'],
        ['{host} would love to see you there.', '@work'], ['Come along; it will be good to see you.', '@work']],
      close: ['Can\'t wait to see you!', 'Let us know you are coming; we will save you a seat.', ['Plenty of food, good company and lots to catch up on.', '#table'],
        ['Looking forward to catching up.', '@work'], ['Let us know you can make it.', '@work']],
      thanks: ['Thanks a ton for coming!', 'Thanks for being such a good friend.', ['Thanks, and see you there!', '@work'], ['Thanks for joining us!', '@work']],
    },
    playful: {
      top: [['Warning: high levels of fun ahead', '#joy'], ['Clear your calendar!', ''], ['Plot twist: there is cake', '@party'], ['Officially off the market', '@love'],
        ['Meetings, but make them fun', '@work'], ['Spoiler alert', '@work']],
      sub: [['are finally doing it, and you are invited to watch', '@love'], ['have said yes, and so should you', '@love'],
        ['Excuses will not be accepted', '@home @gather @party'], ['Calories do not count at a {occ}', '@home @gather @party #table'],
        ['Yes, there will be snacks', '@work #table'], ['{title}: no boring bits, we promise', '@work']],
      open: [['We checked the stars, the calendar and the snack budget. Everything says yes.', ''], ['Breaking news: we are throwing a party.', '@party @gather @home'], ['After a lot of planning and a little panic, it is happening!', '@love']],
      invite: ['{host} can promise good food, better company and at least one embarrassing story.', ['Your attendance is mandatory and your dancing optional.', '#joy'], ['Come for the {occ}, stay for the gossip.', ''],
        ['{host} can promise it will be worth leaving your desk for.', '@work'], ['Come for the ideas, stay for the coffee.', '@work #table']],
      close: ['Say yes now and thank us later.', 'The only thing missing is you, and possibly more chairs.', ['Diets are suspended for the day.', '#table'],
        ['Bring questions; we have answers (and cake).', '@work #table'], ['Reply below before the good seats go.', '@work']],
      thanks: ['Thank you for being this much fun.', 'Thanks for coming, and for the dance moves.', ['Thanks for not hitting snooze on this one.', '@work'], ['Thanks for showing up, it means a lot (really).', '@work']],
    },
    formal: {
      top: [['Formal invitation', ''], ['An invitation', ''], ['On behalf of {host}', ''], ['Official invitation', '@work'], ['Invitation to attend', '@work']],
      sub: [['request the presence of your family at their {occ}', '@love #presence'], ['invite you to attend their {occ}', '@love'],
        ['You are invited to attend the {occ}', '@home @sacred @gather @party'], ['Your attendance is requested', '@home @sacred @gather @party #presence'],
        ['You are invited to attend {title}', '@work'], ['Your participation is requested', '@work #presence']],
      open: [['We are pleased to share the details of the occasion below.', ''], ['It gives us pleasure to extend this invitation.', '']],
      invite: ['{host} would be pleased to welcome you.', ['You are invited to attend the {occ}.', ''], ['We would be grateful for your attendance.', '#gratitude'],
        ['{host} is pleased to invite you to {title}.', '@work'], ['Your participation in the {occ} would be most welcome.', '@work']],
      close: ['Kindly confirm your attendance using the reply below.', ['Further details are given below.', ''],
        ['Please confirm your attendance at your earliest convenience.', '@work'], ['We trust the session will be of value to you.', '@work']],
      thanks: ['Thank you for your kind attention.', ['With thanks and regards.', '#gratitude'], ['Thank you. We appreciate your time.', '@work'], ['With thanks and regards.', '@work #gratitude']],
    },
    premium: {
      top: [['Strictly by invitation', ''], ['Reserved for you', ''], ['An intimate celebration', '@love @party @gather'], ['Private invitation', '@work'], ['By invitation only', '@work']],
      sub: [['invite a select few to witness their union', '@love'], ['have kept a place for you at an intimate celebration', '@love'],
        ['An exclusive {occ} for our inner circle', '@home @gather @party'], ['A private gathering, kept small on purpose', '@home @gather @party @sacred'],
        ['An exclusive preview of {title}', '@work'], ['A private session for invited guests', '@work']],
      open: [['We have kept the guest list small, and you are on it.', ''], ['Only a handful of people are receiving this invitation.', '']],
      invite: ['{host} would be delighted to host you.', ['Your place has been reserved.', ''], ['We invite you to an evening of fine company and finer moments.', ''],
        ['{host} would be pleased to host you at an exclusive preview.', '@work'], ['A seat has been reserved in your name.', '@work']],
      close: ['Kindly confirm so we may prepare for you personally.', 'The evening has been curated with you in mind.', ['Please keep this invitation personal.', ''],
        ['Seats are limited; please confirm early.', '@work'], ['This invitation is personal and non-transferable.', '@work']],
      thanks: ['With our compliments.', 'Thank you for being among the few.', ['With our compliments and thanks.', '@work #gratitude'], ['Thank you for your confirmation.', '@work']],
    },
    family: {
      top: [['From our family to yours', '#family'], ['Family first, always', '#family'], ['The whole family is gathering', '#together'], ['All of us, together', '#together']],
      sub: [['and their families invite yours to the {occ}', '@love #family'], ['want both families, and yours, together for the day', '@love #together'],
        ['The whole family is coming. Will you?', '@home @sacred @gather @party #family'], ['Bring the family; we are celebrating', '@home @sacred @gather @party']],
      open: [['Grandparents, cousins, aunts and uncles: everyone is coming home for this one.', '#family'], ['Our family grows a little bigger every time we celebrate.', '#family']],
      invite: [['{host} would love you and your whole family to come.', '#family'], ['Please bring the children, the elders and everyone in between.', '#family'], ['Come and be part of the family on this day.', '#together']],
      close: [['There will be stories, food and room for everyone.', '#table'], ['Family is not complete without you.', ''], ['We will be waiting, all of us.', '#together']],
      thanks: [['Thank you for being family to us.', '#family'], ['With love from all of us, young and old.', '#together'], ['Thank you for filling our home with warmth.', '#home']],
    },
  };

  // ~warm ~refined ~bright ~devout. Category content is not restricted by @group.
  B.cat = {
    wedding: {
      heart: [['Two families have become one, and the years ahead begin with this day.', '~warm #journey'], ['{names} have found in each other a friend for life.', '~warm #together'],
        ['A marriage begins with a promise, and we would like you to hear it.', '~refined'], ['Seven steps around the sacred fire, and a lifetime of togetherness.', '~devout !hindu #journey'],
        ['Four laavan, sung in the presence of Guru Granth Sahib, will bind two lives together.', '~devout !sikh'], ['Before God and those they love, {names} will make their vows.', '~devout !christian #divine'],
        ['The nikah of {names} will be solemnised in the presence of family and friends.', '~devout !muslim'], ['Every love story deserves a grand celebration, and this one is ours to share.', '~bright #joy'],
        ['With the consent and blessings of both families, {names} begin their married life.', '~devout #bless'], ['{names} are saying yes to a lifetime, and a party to match.', '~bright']],
      welcome: [['As {names} begin their life together, we would love you close by.', '~warm'], ['Welcome to the wedding celebrations. Your affection has been part of their journey.', '~warm #journey'],
        ['We welcome you to witness a union blessed by family and tradition.', '~refined ~devout'], ['Get ready: there will be music, mehendi and much merriment.', '~bright'],
        ['A warm welcome to every friend and relative joining the celebrations.', '~warm']],
      thanks: [['Thank you for blessing the couple as they begin their journey.', '~warm ~devout #bless'], ['Your good wishes are the finest gift the couple will receive.', '~refined'], ['Thank you for dancing, laughing and celebrating with us.', '~bright #joy']],
    },
    engagement: {
      heart: [['A ring, a promise and two families smiling at the same time.', '~bright'], ['{names} are taking the first formal step towards a life together.', '~warm #journey'],
        ['The families of {names} have agreed on a happy match.', '~refined'], ['With the blessings of the elders, rings will be exchanged.', '~devout #bless'], ['They said yes, and now the families get to celebrate.', '~bright #joy']],
      welcome: [['Welcome to the beginning of a beautiful promise.', '~warm'], ['We welcome you to the ring ceremony and the evening that follows.', '~refined'], ['Come early; the rings are not the only thing sparkling tonight.', '~bright']],
      thanks: [['Thank you for celebrating this first promise with us.', '~warm'], ['Your blessings give their new journey a happy start.', '~devout #bless'], ['Thank you for raising a toast to the couple.', '~bright']],
    },
    anniversary: {
      heart: [['Years of shared mornings, small kindnesses and steady companionship are worth celebrating.', '~warm #memory'], ['{names} have built a life of quiet devotion to each other.', '~refined'],
        ['Through every season, they have kept their promise to each other.', '~warm #journey'], ['Their marriage has been a blessing to the whole family.', '~devout #bless'], ['Still laughing at each other\'s jokes after all these years!', '~bright #joy']],
      welcome: [['Welcome to an evening of memories, old friends and gratitude.', '~warm #memory'], ['We welcome you to honour a marriage that has inspired us all.', '~refined'], ['Come and raise a glass to the happy couple.', '~bright']],
      thanks: [['Thank you for being part of so many of their memories.', '~warm #memory'], ['Your friendship has been part of their journey.', '~refined #journey'], ['Thank you for celebrating love that lasts.', '~bright']],
    },
    birthday: {
      heart: [['Another year of laughter, growing and wonderful surprises deserves a proper celebration.', '~bright #joy'], ['Birthdays are a reminder of how lucky we are to have {names} in our lives.', '~warm #heart'],
        ['A new year begins, full of possibility.', '~refined #future'], ['Cake has been ordered and the balloons are ready.', '~bright'], ['We give thanks for another year of health and happiness.', '~devout #gratitude']],
      welcome: [['Welcome to the party! Come hungry and ready to play.', '~bright'], ['We are so glad you could celebrate {names} with us.', '~warm'], ['A warm welcome to family and friends joining the birthday celebration.', '~refined ~warm'], ['Come with your blessings and good wishes for the year ahead.', '~devout #bless']],
      thanks: [['Thank you for making the birthday so special.', '~warm'], ['Thanks for the wishes, the hugs and the cake-eating help!', '~bright'], ['Your good wishes will carry into the year ahead.', '~refined #future']],
    },
    housewarming: {
      heart: [['A house becomes a home the day it is filled with the people we love.', '~warm #home'], ['After years of dreaming and planning, the keys are finally ours.', '~warm #journey'],
        ['We begin life in our new home with a Griha Pravesh puja.', '~devout !hindu !jain'], ['We begin life in our new home with an Ardas and Sukhmani Sahib path.', '~devout !sikh'],
        ['The doors of our new home open for the first time to family and friends.', '~refined #home'], ['New walls, new rooms and a kitchen waiting for its first big meal.', '~bright #table'], ['We are entering our new home with gratitude and prayer.', '~devout #gratitude']],
      welcome: [['Welcome to our new home. Step in, look around and stay a while.', '~warm #home'], ['We welcome you to bless our new home with your presence.', '~devout #bless'], ['Come and see the new place, then stay for the food.', '~bright #table'], ['We look forward to welcoming you over our new threshold.', '~refined']],
      thanks: [['Thank you for filling the new house with warmth on its very first day.', '~warm'], ['May your blessings stay in every corner of our home.', '~devout #bless'], ['Thanks for helping us christen the new place!', '~bright']],
    },
    religious: {
      heart: [['We gather in devotion, to pray for the health and happiness of our family.', '~devout #divine'], ['A puja brings the family together in faith and gratitude.', '~devout ~warm #gratitude'],
        ['The aarti will be followed by prasad for all.', '~devout !hindu !jain #table'], ['The path will conclude with Ardas, followed by langar.', '~devout !sikh #table'],
        ['We offer our prayers with simple hearts and folded hands.', '~devout'], ['In the quiet of prayer, the whole family comes together.', '~warm #together']],
      welcome: [['We welcome you to share in the prayers and the peace of the occasion.', '~devout'], ['Your presence will add to the devotion of the day.', '~devout #presence'], ['Come with your family and join the prayers.', '~warm #family']],
      thanks: [['May the blessings of the day stay with your family.', '~devout #bless'], ['Thank you for joining us in faith and prayer.', '~devout #gratitude'], ['Thank you for praying with us.', '~warm']],
    },
    festival: {
      heart: [['The festival brings the whole family home, and the courtyard is full again.', '~warm #family'], ['Lamps, sweets and laughter: the season of celebration is here.', '~bright #joy'],
        ['Following tradition, we come together to share a meal and the joy of the season.', '~devout #table'], ['It is the time of year when relatives become neighbours and neighbours become family.', '~warm #together'],
        ['A traditional feast is being prepared, the way our elders made it.', '~refined #table']],
      welcome: [['Welcome to our family celebration. There is always room for one more.', '~warm'], ['We welcome you to share the festive spirit with our family.', '~refined'], ['Come hungry, come happy, and bring the children!', '~bright #family']],
      thanks: [['Thank you for sharing the festive season with us.', '~warm'], ['May the festival bring light and happiness to your home.', '~devout'], ['Thanks for making the celebration louder and happier!', '~bright #joy']],
    },
    community: {
      heart: [['Our community is strongest when we take time to meet each other.', '~warm #together'], ['Neighbours, volunteers and families are coming together for a common cause.', '~refined'],
        ['Good things happen when a community sits down together.', '~bright'], ['We gather with gratitude for the people who make this community what it is.', '~devout #gratitude']],
      welcome: [['Everyone is welcome: bring a friend, a neighbour or the whole family.', '~warm #family'], ['We welcome all members and friends of the community.', '~refined'], ['Come along and meet the people who make this neighbourhood special.', '~bright']],
      thanks: [['Thank you for being part of our community.', '~warm'], ['Your participation makes the community stronger.', '~refined'], ['Thanks for showing up for each other.', '~bright']],
    },
    school: {
      heart: [['A year of learning, effort and growth is coming to a proud finish.', '~refined #journey'], ['Our students have worked hard, and now it is time to celebrate them.', '~warm'],
        ['Talent, teamwork and a lot of rehearsals will be on stage.', '~bright'], ['We celebrate the achievements of our students with gratitude to every teacher and parent.', '~refined #gratitude']],
      welcome: [['Parents, teachers and friends are warmly welcome.', '~warm'], ['We welcome you to an afternoon of performances and recognition.', '~refined'], ['Come and cheer for our stars!', '~bright']],
      thanks: [['Thank you for supporting our students.', '~warm'], ['Your encouragement means a great deal to every child.', '~refined'], ['Thanks for cheering the loudest!', '~bright']],
    },
    farewell: {
      heart: [['After years of dedication, {names} is ready for a well-earned new chapter.', '~refined #journey'], ['Some colleagues become friends, and some friends become family.', '~warm #family'],
        ['We could not let a career like this end without a proper send-off.', '~bright'], ['We give thanks for years of service, guidance and kindness.', '~devout #gratitude'], ['It is hard to say goodbye to someone who made every day better.', '~warm #heart']],
      welcome: [['Welcome to an evening of stories, thanks and fond farewells.', '~warm #memory'], ['We welcome you to honour a remarkable journey.', '~refined'], ['Come with your best stories; the more embarrassing, the better.', '~bright']],
      thanks: [['Thank you for the memories you helped create.', '~warm #memory'], ['With gratitude for years of friendship and support.', '~refined #gratitude'], ['Thanks for sending them off in style!', '~bright']],
    },
    custom: {
      heart: [['Some occasions do not fit a label, but they all deserve good company.', '~warm'], ['We are marking a special moment and would like to share it.', '~refined'],
        ['There is a reason to celebrate, and you are part of it.', '~bright #joy'], ['We are grateful for this moment and the people who made it possible.', '~devout #gratitude']],
      welcome: [['A warm welcome to everyone joining us.', '~warm'], ['We welcome you to an occasion that means a great deal to us.', '~refined'], ['Come in, grab a plate and make yourself at home!', '~bright #table']],
      thanks: [['Thank you for being part of the moment.', '~warm'], ['Thank you for your kind presence.', '~refined #presence'], ['Thanks for celebrating with us!', '~bright']],
    },
    corporate: {
      heart: [['This meeting brings our key people together to align on priorities and next steps.', '~refined'], ['We will review progress, share plans and agree on what comes next.', '~refined #future'],
        ['The best decisions are made when the right people are in the room.', '~bright'], ['Your experience will help shape the decisions we take together.', '~warm #together']],
      welcome: [['Welcome. We have planned a focused and productive session.', '~refined'], ['We are glad to have you with us for this meeting.', '~warm'], ['Come ready to share ideas; this one matters.', '~bright']],
      thanks: [['Thank you for your time and contribution.', '~refined'], ['Thank you for being part of the team.', '~warm #together'], ['Thanks; see you at the table.', '~bright']],
    },
    conference: {
      heart: [['Leading voices from the industry will share insights, research and practical experience.', '~refined'], ['Two days of keynotes, panels and conversations that move ideas forward.', '~bright'],
        ['The conference brings practitioners and leaders together to learn from each other.', '~refined #together'], ['Meet peers, hear new ideas and leave with connections that last.', '~warm #future']],
      welcome: [['Welcome to a programme designed for learning and meaningful networking.', '~refined'], ['We are delighted to welcome you as a delegate.', '~warm'], ['Get ready for big ideas and great conversations.', '~bright']],
      thanks: [['Thank you for being part of the conversation.', '~refined'], ['We appreciate your participation and look forward to your insights.', '~warm'], ['Thanks for bringing your ideas to the table.', '~bright']],
    },
    launch: {
      heart: [['After months of work, something new is ready to meet the world.', '~bright #journey'], ['We are unveiling a product built around what our customers asked for.', '~refined'],
        ['Be among the first to see it, try it and tell us what you think.', '~bright'], ['This launch marks an important milestone for our team and partners.', '~refined #future'], ['None of this would exist without the people who believed in it early.', '~warm #gratitude']],
      welcome: [['Welcome to the launch. Expect a first look, live demos and good conversations.', '~bright'], ['We are pleased to welcome you to the unveiling.', '~refined'], ['We are glad you could be here for this moment.', '~warm']],
      thanks: [['Thank you for being part of the launch.', '~refined'], ['Thanks for being one of the first to see it.', '~bright'], ['Thank you for supporting us on this journey.', '~warm #journey']],
    },
  };

  B.relation = {
    family: [['You have shared every big day of our family, and this one would not be complete without you.', '#family'], ['As family, you were the first people we wanted to tell.', '#family']],
    friends: [['Friends like you have been there for every chapter, and we want you here for this one.', '#memory'], ['You are the friends we call first with good news.', '']],
    colleagues: [['Working alongside you has made this possible.', '#gratitude'], ['We would value your presence as a colleague and friend.', '']],
    community: [['As members of our community, your presence means a great deal.', ''], ['We are proud to share this occasion with our community.', '#together']],
    mixed: [['Family, friends and colleagues will all be there, and so should you.', '#together'], ['The people who matter most to us are coming together, and you are one of them.', '']],
  };
  B.practical = ['Please see the notes below for practical details.', 'A few practical notes are given below.'];

  /* ---------- dates, times and the details sentence ---------- */
  const fmtDate = (iso) => { try { return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')); } catch (e) { return iso; } };
  const fmtTime = (hm) => { const [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; return m ? `${hh}:${String(m).padStart(2, '0')} ${ap}` : `${hh} ${ap}`; };
  const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  B.fmtDate = fmtDate; B.fmtTime = fmtTime;
  B.details = (f, mode, v) => {
    const evs = (f.events || []).filter((e) => e.name || e.date);
    if (!evs.length) return '';
    const work = f.group === 'work';
    const when = (e) => [e.date ? fmtDate(e.date) : '', e.time ? 'at ' + fmtTime(e.time) : ''].filter(Boolean).join(' ');
    const place = (e) => [e.venue, e.city].filter(Boolean).join(', ');
    if (evs.length > 1 && mode === 'full') {
      const items = evs.filter((e) => e.name).map((e) => [e.name, e.date ? 'on ' + fmtDate(e.date) : '', e.time ? 'at ' + fmtTime(e.time) : '', place(e) ? 'at ' + place(e) : ''].filter(Boolean).join(' '));
      if (!items.length) return '';
      const joined = items.length > 2 || items.some((x) => x.includes(',')) ? items.slice(0, -1).join('; ') + '; and ' + items[items.length - 1] : list(items);
      return [work ? 'The programme: ' : 'The celebrations unfold over ' + evs.length + ' occasions: ', 'Here is how the days unfold: ', 'Please join us for ' + (work ? 'each session: ' : 'every occasion: ')][v % 3] + joined + '.';
    }
    if (evs.length > 1) {
      const names = evs.map((e) => e.name).filter(Boolean);
      if (names.length > 1) return [`There are ${evs.length} occasions to share: ${list(names)}.`, `The ${work ? 'programme' : 'celebrations'} include ${list(names)}.`, `From ${names[0]} to ${names[names.length - 1]}, we would love you at every one.`][v % 3];
    }
    const e = f.main || evs[0];
    const w = when(e), p = place(e);
    if (!w && !p) return '';
    if (work) return [`${e.name ? 'The ' + e.name.replace(/^the /i, '') : 'It'} takes place${w ? ' on ' + w : ''}${p ? ' at ' + p : ''}.`, `${w ? 'Date: ' + w + '. ' : ''}${p ? 'Venue: ' + p + '.' : ''}`.trim(), `Please note${w ? ' ' + w : ''}${p ? (w ? ', at ' : ' the venue: ') + p : ''} in your calendar.`][v % 3];
    if (!e.date) return [`We will gather at ${p}.`, `The place is ${p}.`, `Find us at ${p}.`][v % 3];
    return [`We will gather on ${w}${p ? ' at ' + p : ''}.`, `Please keep ${w} free${p ? '; we will be at ' + p : ''}.`, `${w.charAt(0).toUpperCase() + w.slice(1)} is the day${p ? ', and ' + p + ' is the place' : ''}.`][v % 3];
  };

  // Poetic: lyrical and image-rich (light, song, rivers, the first page), measured and unhurried
  B.style.poetic = {
    top: [['Two hearts, one song', '@love'], ['Where two paths become one', '@love #journey'], ['Beneath a sky of blessings', '#bless'], ['A lamp, a door, a welcome', '@home #home'],
      ['Of light and gathering', '@gather @party'], ['In the hush of prayer', '@sacred'], ['Another year, another verse', '@party']],
    sub: [['will write the first page of their forever, and hope you will be there', '@love #journey'], ['invite you to the day their two stories become one', '@love #together'], ['ask you to be near when the music begins', '@love'],
      ['Come, let the day be written with you in it', '@home @sacred @gather @party'], ['A celebration as warm as lamplight awaits you', '@home @gather @party']],
    open: ['Some days arrive like a song you have always known.', ['As the evening softens into gold, a new chapter begins.', '#journey'],
      ['Like rivers meeting the sea, two families come together.', '@love #family'], ['Every lamp is lit, every garland strung, every heart ready.', '@love @home @gather @sacred']],
    invite: [['{host} would be honoured to have you among the lights and the laughter.', '@love @home @gather @party'], ['Come and be a verse in the story we are writing today.', '#memory'],
      ['We would love you beside us when the first notes play.', '@love @party @gather'], ['{host} would be glad of your company on this gentle, golden day.', '']],
    close: [['Your presence will be the brightest line of our day.', '#presence'], 'Come, and let the moment be complete.', ['May the day hold you as warmly as you have held us.', '#heart']],
    thanks: [['For every blessing you bring, our hearts say thank you.', '#gratitude'], 'Thank you for being part of our song.', ['With a love that words can only begin to tell.', '#heart']],
  };

  (root.IXCopyBanks = root.IXCopyBanks || {}).en = B;
})(typeof window !== 'undefined' ? window : globalThis);
