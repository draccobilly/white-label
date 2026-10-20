export type GivingVerse = {
  reference: string;
  text: string;
};

/** Public-domain (KJV) passages on giving, mercy, and carrying the Word. */
export const GIVING_VERSES: GivingVerse[] = [
  {
    reference: "Acts 20:35",
    text: "It is more blessed to give than to receive.",
  },
  {
    reference: "2 Corinthians 9:7",
    text: "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.",
  },
  {
    reference: "Proverbs 19:17",
    text: "He that hath pity upon the poor lendeth unto the Lord; and that which he hath given will he pay him again.",
  },
  {
    reference: "Matthew 25:40",
    text: "Verily I say unto you, Inasmuch as ye have done it unto one of the least of these my brethren, ye have done it unto me.",
  },
  {
    reference: "Luke 6:38",
    text: "Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over.",
  },
  {
    reference: "Hebrews 13:16",
    text: "But to do good and to communicate forget not: for with such sacrifices God is well pleased.",
  },
  {
    reference: "Proverbs 11:25",
    text: "The liberal soul shall be made fat: and he that watereth shall be watered also himself.",
  },
  {
    reference: "1 John 3:17",
    text: "But whoso hath this world's good, and seeth his brother have need, and shutteth up his bowels of compassion from him, how dwelleth the love of God in him?",
  },
  {
    reference: "Galatians 6:9-10",
    text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not. As we have therefore opportunity, let us do good unto all men.",
  },
  {
    reference: "Isaiah 58:10",
    text: "And if thou draw out thy soul to the hungry, and satisfy the afflicted soul; then shall thy light rise in obscurity, and thy darkness be as the noonday.",
  },
  {
    reference: "James 2:15-17",
    text: "If a brother or sister be naked, and destitute of daily food, and one of you say unto them, Depart in peace, be ye warmed and filled; notwithstanding ye give them not those things which are needful to the body; what doth it profit? Even so faith, if it hath not works, is dead.",
  },
  {
    reference: "1 Timothy 6:18",
    text: "That they do good, that they be rich in good works, ready to distribute, willing to communicate.",
  },
  {
    reference: "Matthew 10:8",
    text: "Freely ye have received, freely give.",
  },
  {
    reference: "Proverbs 22:9",
    text: "He that hath a bountiful eye shall be blessed; for he giveth of his bread to the poor.",
  },
  {
    reference: "Romans 12:13",
    text: "Distributing to the necessity of saints; given to hospitality.",
  },
  {
    reference: "Matthew 5:16",
    text: "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.",
  },
  {
    reference: "1 Peter 4:10",
    text: "As every man hath received the gift, even so minister the same one to another, as good stewards of the manifold grace of God.",
  },
  {
    reference: "Micah 6:8",
    text: "He hath shewed thee, O man, what is good; and what doth the Lord require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
  },
  {
    reference: "2 Corinthians 8:9",
    text: "For ye know the grace of our Lord Jesus Christ, that, though he was rich, yet for your sakes he became poor, that ye through his poverty might be rich.",
  },
  {
    reference: "Luke 3:11",
    text: "He that hath two coats, let him impart to him that hath none; and he that hath meat, let him do likewise.",
  },
  {
    reference: "Proverbs 3:27",
    text: "Withhold not good from them to whom it is due, when it is in the power of thine hand to do it.",
  },
  {
    reference: "Deuteronomy 15:11",
    text: "For the poor shall never cease out of the land: therefore I command thee, saying, Thou shalt open thine hand wide unto thy brother, to thy poor, and to thy needy, in thy land.",
  },
  {
    reference: "Matthew 6:21",
    text: "For where your treasure is, there will your heart be also.",
  },
  {
    reference: "John 13:34",
    text: "A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another.",
  },
  {
    reference: "2 Corinthians 9:6",
    text: "He which soweth sparingly shall reap also sparingly; and he which soweth bountifully shall reap also bountifully.",
  },
  {
    reference: "Psalm 82:3-4",
    text: "Defend the poor and fatherless: do justice to the afflicted and needy. Deliver the poor and needy: rid them out of the hand of the wicked.",
  },
  {
    reference: "Proverbs 14:31",
    text: "He that oppresseth the poor reproacheth his Maker: but he that honoureth him hath mercy on the poor.",
  },
  {
    reference: "Isaiah 1:17",
    text: "Learn to do well; seek judgment, relieve the oppressed, judge the fatherless, plead for the widow.",
  },
  {
    reference: "Matthew 6:3-4",
    text: "But when thou doest alms, let not thy left hand know what thy right hand doeth: that thine alms may be in secret: and thy Father which seeth in secret himself shall reward thee openly.",
  },
  {
    reference: "Luke 12:33",
    text: "Sell that ye have, and give alms; provide yourselves bags which wax not old, a treasure in the heavens that faileth not.",
  },
];

export function verseForDay(now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start) / 86_400_000);
  return GIVING_VERSES[day % GIVING_VERSES.length]!;
}

export function randomGivingVerse(except?: string) {
  const pool = except
    ? GIVING_VERSES.filter((verse) => verse.reference !== except)
    : GIVING_VERSES;
  const list = pool.length ? pool : GIVING_VERSES;
  return list[Math.floor(Math.random() * list.length)]!;
}
