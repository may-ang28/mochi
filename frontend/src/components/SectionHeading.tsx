function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="section-heading"><h2>{title}</h2><p>{detail}</p></div>
}

export default SectionHeading
