// わが子ドリル工房 — 最初から入っている見本のドリル（AI がなくても試せるように）
window.WAGAKO_SAMPLES = [
  {
    id: 'sample-div',
    sample: true,
    title: 'わり算の筆算（2けた÷1けた）',
    grade: '小4', subject: '算数・数学', unit: 'わり算の筆算（2けた÷1けた）', type: 'input', level: 'normal',
    questions: [
      { q: '84 ÷ 4 は？', a: ['21'], e: '8÷4＝2、4÷4＝1 で 21' },
      { q: '96 ÷ 3 は？', a: ['32'], e: '9÷3＝3、6÷3＝2 で 32' },
      { q: '75 ÷ 5 は？', a: ['15'], e: '7÷5＝1 あまり2、25÷5＝5 で 15' },
      { q: '92 ÷ 4 は？', a: ['23'], e: '9÷4＝2 あまり1、12÷4＝3 で 23' },
      { q: '81 ÷ 3 は？', a: ['27'], e: '8÷3＝2 あまり2、21÷3＝7 で 27' },
      { q: '78 ÷ 6 は？', a: ['13'], e: '7÷6＝1 あまり1、18÷6＝3 で 13' },
      { q: '91 ÷ 7 は？', a: ['13'], e: '9÷7＝1 あまり2、21÷7＝3 で 13' },
      { q: '68 ÷ 4 は？', a: ['17'], e: '6÷4＝1 あまり2、28÷4＝7 で 17' },
    ],
  },
  {
    id: 'sample-be',
    sample: true,
    title: 'be動詞（am / is / are）',
    grade: '中1', subject: '英語', unit: 'be動詞（am / is / are）', type: 'choice', level: 'normal',
    questions: [
      { q: 'I ___ a student.', choices: ['am', 'is', 'are', 'be'], a: ['am'], e: '主語が I のときは am' },
      { q: 'She ___ my sister.', choices: ['am', 'is', 'are', 'be'], a: ['is'], e: 'He・She・It のときは is' },
      { q: 'They ___ in the park.', choices: ['am', 'is', 'are', 'be'], a: ['are'], e: 'They のときは are' },
      { q: 'This ___ my bag.', choices: ['am', 'is', 'are', 'be'], a: ['is'], e: 'This は1つのものなので is' },
      { q: 'You ___ tall.', choices: ['am', 'is', 'are', 'be'], a: ['are'], e: 'You のときは are' },
      { q: 'Ken and I ___ friends.', choices: ['am', 'is', 'are', 'be'], a: ['are'], e: '「ケンとわたし」は2人なので are' },
      { q: 'My mother ___ a teacher.', choices: ['am', 'is', 'are', 'be'], a: ['is'], e: '「わたしの母」は1人なので is' },
      { q: 'We ___ hungry.', choices: ['am', 'is', 'are', 'be'], a: ['are'], e: 'We のときは are' },
    ],
  },
];
