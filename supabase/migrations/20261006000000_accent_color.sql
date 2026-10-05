-- Tilde · color de acento de la app a elección.
-- null = el acento original (naranja). Si no, una clave de la paleta de materias.

alter table public.profiles
  add column accent_color text check (accent_color is null or public.is_color_key(accent_color));
