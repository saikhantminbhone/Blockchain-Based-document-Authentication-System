// src/pages/AboutPage.jsx

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, Box, Zap, Eye, Linkedin, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

// Data for the "Our Story" timeline
const story = [
  {
    icon: <div className="font-bold text-lg">1</div>,
    title: "The Spark: A Problem of Trust",
    text: "The rental market, especially in a bustling city like Bangkok, moves fast. But this speed often comes with a risk: fraudulent documents. We saw the need for a system that could instantly and undeniably verify agreements, protecting everyone involved.",
  },
  {
    icon: <div className="font-bold text-lg">2</div>,
    title: "The Idea: Connecting AI & Blockchain",
    text: "The solution required two key technologies. First, an intelligent AI to read and understand complex documents like title deeds. Second, an immutable blockchain to create a permanent, tamper-proof record of the verified information. We decided to build a bridge between these two worlds.",
  },
  {
    icon: <div className="font-bold text-lg">3</div>,
    title: "The Platform: Block Lease is Born",
    text: "Block Lease is the result: a complete ecosystem for digital trust. It's a platform that doesn't just verify a single document, but establishes a full 'chain of trust'—from the landlord's identity to their property ownership, and finally, to the rental contract itself.",
  }
];

// Data for the "Core Principles" section
const principles = [
    { icon: <ShieldCheck/>, title: "Ironclad Security", text: "Leveraging professional KYC, multi-document AI checks, and blockchain immutability to secure every step." },
    { icon: <Eye/>, title: "Radical Transparency", text: "Providing a public, verifiable record for every approved contract that anyone can check, anytime." },
    { icon: <Zap/>, title: "Seamless Simplicity", text: "Hiding the complexity of blockchain with a gasless experience and intuitive design for all users." },
];

export default function AboutPage() {
  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  return (
    <div className="bg-background text-text-primary">
      {/* --- Dynamic Hero with Gradient Glows --- */}
      <div className="relative h-[60vh] flex items-center justify-center text-center text-white overflow-hidden">
        <div className="absolute inset-0 bg-footer"></div>
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-r from-primary/50 to-accent/50 rounded-full blur-3xl animate-float opacity-40"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-l from-accent/50 to-primary/50 rounded-full blur-3xl animate-float opacity-40 [animation-delay:-7s]"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative z-10 p-4"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold">Our Mission</h1>
          <p className="mt-4 text-xl max-w-3xl mx-auto text-white/80">
            To bring absolute trust and transparency to the rental market through elegant, user-friendly technology.
          </p>
        </motion.div>
      </div>

      {/* --- Main Content Section --- */}
      <div className="max-w-4xl mx-auto py-20 px-4 space-y-24">
        
        {/* "Our Story" Timeline Section */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary">Our Story</h2>
            <p className="mt-2 text-lg text-text-secondary">From a complex problem to a simple solution.</p>
          </div>
          <div className="relative pl-8">
            {/* The vertical timeline bar */}
            <div className="absolute left-8 top-0 h-full w-0.5 bg-primary/20"></div>
            <div className="space-y-16">
              {story.map((item, index) => (
                <div key={index} className="relative flex items-start gap-8">
                  <div className="absolute left-0 top-1 w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center -translate-x-1/2 ring-8 ring-background">
                    {item.icon}
                  </div>
                  <div className="pl-16">
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="mt-2 text-text-secondary">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* "Core Principles" Grid */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-text-primary">Our Core Principles</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
                {principles.map(p => (
                    <div key={p.title} className="text-center p-6">
                        <div className="w-12 h-12 mx-auto flex items-center justify-center text-accent">{React.cloneElement(p.icon, { size: 32 })}</div>
                        <h4 className="mt-4 font-bold text-lg">{p.title}</h4>
                        <p className="mt-1 text-sm text-text-secondary">{p.text}</p>
                    </div>
                ))}
            </div>
        </motion.section>
        
        {/* "Meet the Creator" Section */}
        <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="pt-16 border-t border-text-muted/10">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-1">
              <img src="https://i.pravatar.cc/300?u=founder" alt="Founder" className="w-48 h-48 rounded-full mx-auto shadow-lg" />
            </div>
            <div className="md:col-span-2 text-center md:text-left">
              <h2 className="text-3xl font-bold text-text-primary">Meet the Creator</h2>
              <h4 className="text-xl font-semibold text-primary mt-2">Sai Khant Min Bhone</h4>
              <p className="text-accent text-sm font-semibold">Software Engineer & Blockchain Architect</p>
              <p className="mt-4 text-text-secondary">
                  As a final year student passionate about emerging technologies, I created Block Lease to explore a practical, real-world application for AI and blockchain that solves a tangible problem. This project is the culmination of my studies in software engineering and decentralized systems.
              </p>
              <div className="mt-6 flex justify-center md:justify-start gap-4">
                  <Link to="https://www.linkedin.com/in/saikhantminbhone/" className="text-text-secondary hover:text-primary"><Linkedin/></Link>
                  <Link to="https://github.com/saikhantminbhone" className="text-text-secondary hover:text-primary"><Github/></Link>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}