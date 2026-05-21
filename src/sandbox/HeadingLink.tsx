interface Props {
  id: string
}

export default function HeadingLink({ id }: Props) {
  return (
    <a className="heading-link" href={`#${id}`} aria-label="Link to this section">
      [link]
    </a>
  )
}
