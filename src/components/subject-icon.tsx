import {
  Atom,
  BedDouble,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Bus,
  Calculator,
  Camera,
  ChartLine,
  CircuitBoard,
  Code,
  Coffee,
  Cog,
  Coins,
  Cpu,
  Database,
  Dna,
  DraftingCompass,
  Drama,
  Dumbbell,
  Film,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  Guitar,
  Hammer,
  Heart,
  HeartPulse,
  House,
  Landmark,
  Languages,
  Leaf,
  Library,
  Lightbulb,
  Magnet,
  Megaphone,
  Microscope,
  Music,
  Network,
  Newspaper,
  NotebookPen,
  Palette,
  PawPrint,
  PencilRuler,
  PenTool,
  Pi,
  Plane,
  Presentation,
  Scale,
  ShoppingCart,
  Sigma,
  SquareFunction,
  Star,
  Stethoscope,
  Telescope,
  Terminal,
  Trophy,
  Users,
  Utensils,
  Volleyball,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement } from "react";
import { isIconKey, type IconKey } from "@/lib/domain/icons";
import { cn } from "@/lib/utils";

const ICONS: Record<IconKey, LucideIcon> = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "notebook-pen": NotebookPen,
  "pencil-ruler": PencilRuler,
  library: Library,
  languages: Languages,
  presentation: Presentation,
  lightbulb: Lightbulb,
  calculator: Calculator,
  sigma: Sigma,
  pi: Pi,
  "square-function": SquareFunction,
  atom: Atom,
  "flask-conical": FlaskConical,
  microscope: Microscope,
  dna: Dna,
  brain: Brain,
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  leaf: Leaf,
  globe: Globe,
  telescope: Telescope,
  zap: Zap,
  magnet: Magnet,
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  database: Database,
  network: Network,
  "circuit-board": CircuitBoard,
  cog: Cog,
  "drafting-compass": DraftingCompass,
  scale: Scale,
  landmark: Landmark,
  briefcase: Briefcase,
  "chart-line": ChartLine,
  coins: Coins,
  users: Users,
  megaphone: Megaphone,
  newspaper: Newspaper,
  palette: Palette,
  music: Music,
  camera: Camera,
  film: Film,
  drama: Drama,
  "pen-tool": PenTool,
  "building-2": Building2,
  hammer: Hammer,
  dumbbell: Dumbbell,
  volleyball: Volleyball,
  bike: Bike,
  trophy: Trophy,
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  "bed-double": BedDouble,
  "shopping-cart": ShoppingCart,
  "gamepad-2": Gamepad2,
  heart: Heart,
  star: Star,
  plane: Plane,
  house: House,
  "paw-print": PawPrint,
  guitar: Guitar,
};

/** El componente de Lucide de una clave, o null si no hay ícono (o la clave ya no existe). */
export function iconComponent(icon: string | null | undefined): LucideIcon | null {
  return isIconKey(icon) ? ICONS[icon] : null;
}

type SubjectIconProps = { icon: string | null | undefined; size?: number; className?: string };

/** El ícono elegido para una materia o actividad. No dibuja nada si no tiene. */
export function SubjectIcon({ icon, size = 14, className }: SubjectIconProps) {
  if (!isIconKey(icon)) return null;
  // data-icon: el exportador del horario busca el <svg> por su clave para copiar los trazos.
  const props: LucideProps & { "data-icon": string } = { size, className: cn("s-icon", className), "data-icon": icon, "aria-hidden": true };
  return createElement(ICONS[icon], props);
}

/** Marca de una materia en chips y listas: su ícono o, si no eligió ninguno, el punto de color. */
export function SubjectMark({ icon, size = 14, dotClassName }: SubjectIconProps & { dotClassName?: string }) {
  return iconComponent(icon) ? <SubjectIcon icon={icon} size={size} /> : <span className={cn("dot", dotClassName)} aria-hidden="true" />;
}

/** Ícono sobre un cuadrado con el color de la materia (tarjeta, panel y popovers). */
export function SubjectTile({ icon, size = "md", className }: { icon: string | null | undefined; size?: "sm" | "md"; className?: string }) {
  if (!iconComponent(icon)) return null;
  return (
    <span className={cn("subject-tile", size === "sm" && "is-sm", className)} aria-hidden="true">
      <SubjectIcon icon={icon} size={size === "sm" ? 14 : 18} />
    </span>
  );
}
