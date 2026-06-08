import React from 'react';
import './AboutDevelopersModal.css';

const DEVELOPERS = [
  {
    id: 6,
    name: 'Khenje S. Boligao',
    role: 'Developer',
    email: 'khenjeboligao79@gmail.com',
    image: '/boligao.jpg',
    isLead: true,
  },
  {
    id: 1,
    name: 'Iori John M. Bernardez',
    role: 'Developer',
    email: 'ioribernardez@gmail.com',
    image: '/bernardez.jpg',
    isLead: false,
  },
  {
    id: 5,
    name: 'Armando C. Crusat Jr',
    role: 'Developer',
    email: 'crusatarmandojr@gmail.com',
    image: '/crusat.jpg',
    isLead: false,
  },
  {
    id: 3,
    name: 'Jhon Robert Colaljo',
    role: 'Developer',
    email: 'johnjhoncolaljo@gmail.com',
    image: '/colaljo.jpg',
    isLead: false,
  },
  {
    id: 2,
    name: 'Wenebee E. Alfante',
    role: 'Developer',
    email: 'alfantewenebee@gmail.com',
    image: '/alfante.jpg',
    isLead: false,
  },
  {
    id: 4,
    name: 'Ana Mae R. Pizarras',
    role: 'Developer',
    email: 'pizarrasanamae@gmail.com',
    image: '/pizarras.jpg',
    isLead: false,
  },
];

export default function AboutDevelopersModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-modal-modal-overlay" onClick={onClose}>
      <div className="about-developers-modal" onClick={e => e.stopPropagation()}>
        <button
          className="about-modal-close"
          onClick={onClose}
          aria-label="Close modal"
          type="button"
        >
          ✕
        </button>

        <div className="about-modal-header">
          <img src="/logo-dashboard.png" alt="Calape Logo" className="about-modal-logo" />
          <div className="about-modal-header-text">
            <h2 className="about-modal-title">Calape Document Tracking System</h2>
            <p className="about-modal-subtitle">BISU Calape</p>
            <p className="about-modal-description">OJT Project Development</p>
          </div>
        </div>

        <div className="about-developers-grid">
          {DEVELOPERS.map(dev => (
            <div key={dev.id} className="developer-card">
              <img
                src={dev.image}
                alt={dev.name}
                className="developer-image"
                onError={e => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e0e7ff" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="48" text-anchor="middle" dy=".3em" fill="%235a67d8"%3E%3F%3C/text%3E%3C/svg%3E';
                }}
              />

              <div className="developer-info">
                <h3 className="developer-name">{dev.name}</h3>
                
                <div className="developer-role">
                  <span className="role-icon">👤</span>
                  <span>{dev.role}</span>
                </div>

                <div className="developer-email">
                  <span className="email-icon">✉️</span>
                  <a href={`mailto:${dev.email}`}>{dev.email}</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
