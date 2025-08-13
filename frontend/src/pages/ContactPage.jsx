// src/pages/ContactPage.jsx
import { useState } from 'react';
import axios from 'axios';
import { Mail, Linkedin, Github } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { showSuccessToast, showErrorToast } from '../components/Notifications';

export default function ContactPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const data = {
      ...formData,
      access_key: import.meta.env.VITE_APP_WEB3FORMS_ACCESS_KEY,
      subject: `New Message from Block Lease Contact Form`,
    };

    try {
      const response = await axios.post('https://api.web3forms.com/submit', data);
      if (response.data.success) {
        showSuccessToast('Your message has been sent successfully!');
        setFormData({ name: '', email: '', message: '' }); // Clear form
      } else {
        showErrorToast('There was an error sending your message.');
      }
    } catch (error) {
      showErrorToast('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-16 px-4 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-text-primary">Get in Touch</h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
          Have a question or a proposal? We'd love to hear from you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-card p-8 rounded-2xl border border-text-muted/10">
        {/* Left Column: Form */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">Full Name</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">Email Address</label>
              <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-text-secondary mb-1">Message</label>
              <textarea name="message" id="message" rows="5" value={formData.message} onChange={handleChange} required className="w-full p-2 border rounded-md"></textarea>
            </div>
            <Button type="submit" isLoading={isLoading} className="w-full bg-primary hover:bg-hover-blue">
              Send Message
            </Button>
          </form>
        </div>

        {/* Right Column: Contact Info */}
        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <Mail className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-text-primary">Email</h3>
              <p className="text-text-secondary">Directly contact the project lead.</p>
              <a href="mailto:saikhantminbhoneth@gmail.com" className="text-info hover:underline">saikhantminbhoneth@gmail.com</a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Linkedin className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-text-primary">LinkedIn</h3>
              <p className="text-text-secondary">Connect on a professional level.</p>
              <a href="https://www.linkedin.com/in/saikhantminbhone" className="text-info hover:underline">linkedin.com/in/saikhantminbhone</a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Github className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-text-primary">GitHub</h3>
              <p className="text-text-secondary">View the source code for this project.</p>
              <a href="https://github.com/saikhantminbhone/Blockchain-Based-document-Authentication-System" className="text-info hover:underline">github.com/saikhantminbhone/Blockchain-Based-document-Authentication-System</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}