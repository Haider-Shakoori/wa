import { BsGridFill } from 'react-icons/bs';
import { FaMagnifyingGlass, FaMobileScreenButton, FaCreditCard, FaKey, FaRightFromBracket, FaBars, FaRotate, FaArrowUpRightFromSquare, FaArrowRight, FaArrowLeft, FaCircleQuestion, FaLayerGroup, FaPaperPlane, FaBolt, FaChartColumn, FaClock, FaCommentDots, FaImage, FaFileLines, FaMicrophone, FaAddressCard, FaLocationDot, FaUsers, FaCode, FaShieldHalved, FaCartShopping, FaBell, FaRobot, FaQrcode, FaCheck, FaEnvelope, FaUser, FaLock, FaEye, FaEyeSlash, FaRightToBracket, FaUserPlus, FaPlus, FaCopy, FaTrashCan } from 'react-icons/fa6';

const icons = { search: FaMagnifyingGlass, grid: BsGridFill, smartphone: FaMobileScreenButton, credit: FaCreditCard, key: FaKey, logout: FaRightFromBracket, menu: FaBars, refresh: FaRotate, external: FaArrowUpRightFromSquare, right: FaArrowRight, left: FaArrowLeft, help: FaCircleQuestion, layers: FaLayerGroup, send: FaPaperPlane, events: FaBolt, chart: FaChartColumn, clock: FaClock, message: FaCommentDots, image: FaImage, document: FaFileLines, voice: FaMicrophone, contact: FaAddressCard, location: FaLocationDot, users: FaUsers, code: FaCode, shield: FaShieldHalved, cart: FaCartShopping, bell: FaBell, robot: FaRobot, qr: FaQrcode, check: FaCheck, mail: FaEnvelope, user: FaUser, lock: FaLock, eye: FaEye, eyeOff: FaEyeSlash, login: FaRightToBracket, signup: FaUserPlus, plus: FaPlus, copy: FaCopy, trash: FaTrashCan };
export type FeatherName = keyof typeof icons;
export function FeatherIcon({ name, size = 20 }: { name: FeatherName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} aria-hidden="true" focusable="false" className="rw-icon"/>;
}
