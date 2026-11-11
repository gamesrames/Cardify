import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Único ponto que conhece a biblioteca de ícones (MaterialCommunityIcons, licença Apache 2.0 / OFL).
// As telas usam <Icon name="..."> e nunca emoji: emoji muda de desenho de um celular para outro.
// A lista abaixo é o subconjunto que o app usa; para um ícone novo, acrescente o nome aqui
// (catálogo em https://pictogrammers.com/library/mdi/).
export type IconName =
  | 'fire'
  | 'leaf'
  | 'terrain'
  | 'weather-windy'
  | 'water'
  | 'lightning-bolt'
  | 'lightning-bolt-outline'
  | 'sword'
  | 'heart'
  | 'cards'
  | 'cards-outline'
  | 'camera'
  | 'robot'
  | 'account'
  | 'account-circle'
  | 'account-multiple'
  | 'flag-variant'
  | 'volume-high'
  | 'volume-off'
  | 'help-circle-outline'
  | 'chevron-left'
  | 'timer-outline'
  | 'trophy'
  | 'skull'
  | 'handshake'
  | 'cloud-check-outline'
  | 'cloud-off-outline'
  | 'check-circle'
  | 'alert-circle-outline'
  | 'image-plus'
  | 'close';

interface Props {
  name: IconName;
  size: number;
  color: string;
}

export function Icon({ name, size, color }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
