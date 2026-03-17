export interface Project {
  title: string;
  slug: string;
  tags?: string[]; // e.g. ['WebGL', 'XR', 'Campaign']
  year?: string;
  description?: string; // short teaser
  image?: string; // placeholder or real thumbnail URL
}

export const projects: Project[] = [
  {
    title: 'FRONTIERS WITHIN',
    slug: 'frontiers-within',
    description: 'Explore the boundaries of digital space and immersive interactions.',
    tags: ['Interactive', 'WebGL', 'Experience'],
  },
  {
    title: 'KANDINSKY',
    slug: 'kandinsky',
    description: 'An immersive generative art experience inspired by spatial abstraction.',
    tags: ['Art', 'Generative', 'VR'],
  },
  {
    title: 'RACER',
    slug: 'racer',
    description: 'A high-speed WebGL racing experiment pushing the limits of physics.',
    tags: ['Games', 'Simulation', 'WebGL'],
  },
  {
    title: 'E.C.H.O.',
    slug: 'echo',
    description: 'Volumetric spatial audio installation visualizing sound in 3D space.',
    tags: ['XR', 'Audio', 'Installation'],
  },
  {
    title: 'MEMORY',
    slug: 'memory',
    description: 'A journey through digital archives and fragmented historical data.',
    tags: ['Interactive', 'Immersive', 'Archive'],
  }
];
