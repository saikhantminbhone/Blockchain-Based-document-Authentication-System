// src/pages/BlogPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import { ArrowRight } from 'lucide-react';

// Sample blog post data - Added one more for a better layout
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
  {
    category: 'Security',
    title: 'A Landlord\'s Guide to Digital Security in 2025',
    excerpt: 'Learn the best practices for securing your digital assets and rental agreements in an increasingly complex online world.',
    author: 'Sai Khant Min Bhone',
    date: 'June 30, 2025',
    image: '/assets/blog-security.jpg',
    href: '#',
  },
];

// Separate the articles for the new layout
const featuredArticle = articles[0];
const otherArticles = articles.slice(1);


export default function BlogPage() {
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 animate-fade-in">
      {/* --- Header --- */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-text-primary">Insights & News</h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
          Exploring the intersection of technology, real estate, and digital trust.
        </p>
      </div>
      
      {/* --- NEW: Featured Article Section --- */}
      <section className="mb-16">
        <Link to={featuredArticle.href} className="group block">
            <Card className="p-0 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
                <div className="relative overflow-hidden">
                    <img 
                      src={featuredArticle.image} 
                      alt={featuredArticle.title} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                </div>
                <div className="p-8 sm:p-10 flex flex-col">
                    <p className="text-sm font-semibold text-accent mb-2">{featuredArticle.category}</p>
                    <h2 className="text-3xl font-bold text-text-primary group-hover:text-primary transition-colors">{featuredArticle.title}</h2>
                    <p className="mt-4 text-text-secondary text-base flex-grow">{featuredArticle.excerpt}</p>
                    <div className="mt-6 flex justify-between items-center">
                        <div className="text-xs text-text-muted">
                            <span>By {featuredArticle.author}</span> &middot; <span>{featuredArticle.date}</span>
                        </div>
                        <div className="flex items-center text-sm font-semibold text-primary group-hover:underline">
                            Read More <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
      </section>

      {/* --- More Articles Grid --- */}
      <section>
        <h2 className="text-3xl font-bold text-text-primary mb-8">More Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherArticles.map((article) => (
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
                    <h3 className="text-xl font-bold text-text-primary group-hover:text-primary transition-colors">{article.title}</h3>
                    <p className="mt-3 text-text-secondary text-sm flex-grow">{article.excerpt}</p>
                    <div className="mt-6 border-t border-text-muted/10 pt-4 text-xs text-text-muted">
                      <span>By {article.author}</span> &middot; <span>{article.date}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}