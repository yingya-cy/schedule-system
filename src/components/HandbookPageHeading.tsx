interface Props {
  title: string;
  description?: string;
  art: keyof typeof artwork;
}

const artwork = {
  dashboard: '/brand/doodle-dashboard.webp',
  calendar: '/brand/doodle-calendar.webp',
  archive: '/brand/doodle-archive.webp',
  scoring: '/brand/doodle-scoring.webp',
  profile: '/brand/doodle-profile.webp',
  counsel: '/brand/doodle-counsel.webp',
  users: '/brand/doodle-users.webp',
  courses: '/brand/doodle-courses.webp',
  contacts: '/brand/doodle-contacts.webp',
  chat: '/brand/doodle-chat.webp',
};

export default function HandbookPageHeading({ title, description, art }: Props) {
  return (
    <div className="handbook-page-heading">
      <img className="handbook-header-art" src={artwork[art]} alt="" width="64" height="64" />
      <div>
        <h1 className="handbook-title text-2xl font-bold text-on-surface font-headline">{title}</h1>
        {description && <p className="text-sm text-on-surface-variant mt-1">{description}</p>}
      </div>
    </div>
  );
}
