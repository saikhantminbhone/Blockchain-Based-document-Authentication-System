// src/pages/BlogPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';

// Sample blog post data
const articles = [
  {
    category: 'Blockchain',
    title: 'How Blockchain is Eliminating Fraud in Bangkok\'s Rental Market',
    excerpt: 'Explore how immutable ledgers provide a single source of truth, making rental agreement disputes a thing of the past.',
    author: 'Sai Khant Min Bhone',
    date: 'August 8, 2025',
    image: '/assets/blog-blockchain.jpg',
    href: '#',
  },
  {
    category: 'Artificial Intelligence',
    title: 'Unlocking the Power of AI: Verifying Title Deeds with Confidence',
    excerpt: 'A deep dive into how modern AI like Google Gemini can analyze documents for authenticity and extract critical data, adding a new layer of security.',
    author: 'Sai Khant Min Bhone',
    date: 'July 25, 2025',
    image: '/assets/blog-ai.jpg',
    href: '#',
  },
  {
    category: 'UX & Technology',
    title: 'Why \'Gasless\' is the Future for Mainstream Web3 Applications',
    excerpt: 'Blockchain apps are often complex. Learn why sponsoring transactions (gas fees) is the key to creating user-friendly experiences for everyone.',
    author: 'Sai Khant Min Bhone',
    date: 'July 10, 2025',
    image: '/assets/blog-gasless.jpg',
    href: '#',
  },
];

export default function BlogPage() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 animate-fade-in">
      {/* --- Header --- */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-text-primary">Insights</h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
          Exploring the intersection of technology, real estate, and digital trust.
        </p>
      </div>
      
      {/* --- Article Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articles.map((article) => (
          <Link to={article.href} key={article.title} className="group">
            <Card className="p-0 overflow-hidden h-full flex flex-col">
              <div className="overflow-hidden">
                <img 
                  src={article.image} 
                  alt={article.title} 
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <p className="text-sm font-semibold text-accent mb-2">{article.category}</p>
                <h2 className="text-xl font-bold text-text-primary group-hover:text-primary transition-colors">{article.title}</h2>
                <p className="mt-3 text-text-secondary text-sm flex-grow">{article.excerpt}</p>
                <div className="mt-6 border-t border-text-muted/10 pt-4 text-xs text-text-muted">
                  <span>By {article.author}</span> &middot; <span>{article.date}</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}