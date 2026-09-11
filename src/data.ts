export type Section = 'feed' | 'questions' | 'journals' | 'communities' | 'garage' | 'saved';
export type Category =
  | 'Все темы'
  | 'Ремонт и обслуживание'
  | 'Тюнинг и стиль'
  | 'Выбор автомобиля'
  | 'Путешествия';
export interface Reply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}
export interface Post {
  id: string;
  author: string;
  initials: string;
  color: string;
  car: string;
  brand: string;
  title: string;
  body: string;
  category: Category;
  kind: 'question' | 'journal';
  createdAt: string;
  likes: number;
  replies: Reply[];
  acceptedReply?: string;
  image?: string;
  own?: boolean;
}
export interface Car {
  id: string;
  brand: string;
  model: string;
  year: string;
  engine: string;
}
export const brands = [
  'Toyota',
  'BMW',
  'Mercedes-Benz',
  'Hyundai',
  'Kia',
  'Lexus',
  'Volkswagen',
  'Audi',
  'Другая',
];
export const categories: Category[] = [
  'Все темы',
  'Ремонт и обслуживание',
  'Тюнинг и стиль',
  'Выбор автомобиля',
  'Путешествия',
];
export const brandMarks: Record<string, string> = {
  Toyota: 'T',
  BMW: 'BMW',
  'Mercedes-Benz': '✧',
  Hyundai: 'H',
  Kia: 'KIA',
  Lexus: 'L',
  Volkswagen: 'VW',
  Audi: '◎',
};
export const initialPosts: Post[] = [
  {
    id: 'camry-noise',
    author: 'Алихан',
    initials: 'А',
    color: 'sand',
    car: 'Toyota Camry XV50 · 2.5',
    brand: 'Toyota',
    title: 'Camry 50: откуда стук на мелких неровностях?',
    body: 'На небольших ямах появился глухой стук спереди справа. На ровной дороге всё тихо, в руль не отдаёт. Пробег 168 000 км. Кто сталкивался с похожим и с чего начинали диагностику? Хочется понять причину, прежде чем менять всё подряд.',
    category: 'Ремонт и обслуживание',
    kind: 'question',
    createdAt: '2026-09-10T07:20:00Z',
    likes: 18,
    replies: [
      {
        id: 'camry-r1',
        author: 'Данияр',
        text: 'У моей Camry похожий звук был из-за стойки стабилизатора, но по описанию точно не определить. На сервисе проверили подвеску под нагрузкой и показали люфт. Лучше сначала диагностика, а уже потом запчасти.',
        createdAt: '2026-09-10T08:00:00Z',
      },
    ],
    acceptedReply: 'camry-r1',
  },
  {
    id: 'bmw-journal',
    author: 'Тимур',
    initials: 'Т',
    color: 'blue',
    car: 'BMW 3 серии E46 · 2.5',
    brand: 'BMW',
    title: 'Вторая жизнь E46. Начинаю с деталей',
    body: 'Забрал машину, о которой думал ещё со школы. Впереди много работы, но начну с простого: восстановление оптики, уход за салоном и возвращение заводского вида. Буду записывать каждый этап сюда. Первый вывод: список желаний растёт быстрее, чем заканчиваются выходные.',
    category: 'Тюнинг и стиль',
    kind: 'journal',
    createdAt: '2026-09-09T14:30:00Z',
    likes: 34,
    replies: [],
    image: '/images/bmw.jpg',
  },
  {
    id: 'kia-first',
    author: 'Аружан',
    initials: 'А',
    color: 'pink',
    car: 'В поиске первой машины',
    brand: 'Kia',
    title: 'Первый автомобиль до 8 млн ₸: что выбрали бы вы?',
    body: 'Ищу машину для города и редких поездок из Астаны в Караганду. Смотрю на Kia Rio и Hyundai Accent с автоматом. Важнее предсказуемое обслуживание, чем комплектация. Расскажите, что нравится в вашей машине, а что стало неприятным сюрпризом.',
    category: 'Выбор автомобиля',
    kind: 'question',
    createdAt: '2026-09-09T10:00:00Z',
    likes: 12,
    replies: [],
  },
  {
    id: 'mountain-drive',
    author: 'Санжар',
    initials: 'С',
    color: 'green',
    car: 'Toyota Land Cruiser Prado · 4.0',
    brand: 'Toyota',
    title: 'Один выходной, горы и никакой спешки',
    body: 'Иногда лучшая доработка автомобиля — просто на нём куда-нибудь поехать. Выбрались за город ранним утром, взяли термос и вернулись уже к вечеру. Делюсь настроением поездки. Какие короткие маршруты рядом с Алматы любите вы?',
    category: 'Путешествия',
    kind: 'journal',
    createdAt: '2026-09-08T11:10:00Z',
    likes: 27,
    replies: [],
    image: '/images/mountains.jpg',
  },
  {
    id: 'hyundai-care',
    author: 'Руслан',
    initials: 'Р',
    color: 'purple',
    car: 'Hyundai Elantra AD · 1.6',
    brand: 'Hyundai',
    title: 'Что записываете в историю обслуживания?',
    body: 'Решил собрать все заказ-наряды в одном месте. Пока отмечаю дату, пробег, детали и стоимость работ. Думаю добавлять фотографии старых запчастей и чеки. Поделитесь, как ведёте свою историю, чтобы через год ничего не вспоминать по памяти.',
    category: 'Ремонт и обслуживание',
    kind: 'question',
    createdAt: '2026-09-08T08:10:00Z',
    likes: 8,
    replies: [],
  },
];
