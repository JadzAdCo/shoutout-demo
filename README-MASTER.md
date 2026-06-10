# Jadz AdCo ShoutOut Platform

## Master Technical & Functional Specification

### Version History: v1 – v21

---

# Executive Summary

The Jadz AdCo ShoutOut Platform is a digital nightlife engagement platform designed for:

* Nightclubs
* Lounges
* Lounge-Clubs
* Beach Clubs
* Events

The platform allows patrons to:

* Authenticate using Google, Microsoft, Facebook, or Phone OTP
* Discover nightlife venues and events
* Purchase experiences
* Submit LED ShoutOut messages
* Display approved content on LED screens through Xibo CMS

---

# Platform Architecture

Patron Portal

↓

Firebase Authentication

↓

Firebase Firestore

↓

Admin Portal

↓

Xibo CMS

↓

Display URL

↓

LED Display

### Technology Stack

Frontend

* HTML5
* CSS3
* JavaScript ES6

Authentication

* Google Authentication
* Microsoft Authentication
* Facebook Authentication
* Phone OTP Authentication

Backend

* Firebase Firestore

Hosting

* GitHub Pages

CMS

* Xibo Cloud CMS

LED Hardware

* Huidu A4L
* Huidu R712
* Flexible LED Panels

---

# Authentication Evolution

## v1

Google Authentication

## v5

Microsoft Authentication

## v7

Facebook Authentication

## v8

Phone OTP Authentication

## v21

Added:

* User profile photo support
* Google-style profile menu
* Top-right user status panel
* Dropdown sign-out capability

---

# Patron Workflow

## Screen 1 – Authentication

Options:

* Continue with Google
* Continue with Microsoft
* Continue with Facebook
* Continue with Phone OTP

After successful authentication:

↓

Screen 2

---

## Screen 2 – Main Categories

Search for:

* Events
* Clubs
* Beach Clubs
* Lounges
* Lounge-Clubs

Or throw a:

* ShoutOut

---

## Screen 3 – Sponsored Splash Screen

Displays for 5 seconds before category search.

### Events

Nike Air Max

### Clubs

Gucci Fragrances

### Lounge-Clubs

Gran Coramino Tequila (Kevin Hart)

### Lounges

Teremana Tequila (Dwayne Johnson)

### Beach Clubs

Advertise Here

### ShoutOut

Advertise Here

---

# Events Module

Search Filters

* Country
* State
* Region
* Province
* City
* Genre
* Artist
* Event Day
* Event Time

Actions

* Buy Ticket
* Throw ShoutOut

Future Integrations

* Ticketmaster
* Eventbrite
* Resident Advisor

---

# Clubs Module

Search Filters

* Country
* State
* Region
* Province
* City
* Music Genre
* Artist
* DJ

Actions

* Reserve a Table
* Join Guest List
* Pay VIP Entry
* Pay Event Entry
* Pay Standard Entry

---

# ShoutOut Workflow

1. Select Club
2. Select Template
3. Enter Message
4. Preview Content
5. Submit
6. Admin Approval Queue
7. Xibo Scheduling
8. LED Playback

---

# Venue Categories

## Clubs

Traditional Nightclubs

Examples

* Marquee New York
* Nebula New York
* Academy LA
* Exchange LA

---

## Lounges

Examples

* Signature Club DC

---

## Lounge-Clubs

Examples

* Josephine Atlanta
* Tongue & Groove Atlanta
* REVE Atlanta
* LAVO New York
* E11EVEN Miami

---

## Beach Clubs

Examples

* Shôko Barcelona
* Nammos Mykonos

---

# Venue Database

## United States

### Washington, DC

* Zebbies Garden
* Heist DC
* Signature Club

### Atlanta, Georgia

* Josephine
* District Atlanta
* Tongue & Groove
* REVE

### Miami, Florida

* LIV
* Club Space
* E11EVEN

### New York, New York

* Marquee
* LAVO
* Nebula

### Los Angeles, California

* Academy LA
* Exchange LA
* Sound Nightclub

---

## Europe

### Barcelona, Spain

* Shôko Beach Club

### Cannes, France

* Chrystie Cannes

### Ibiza, Spain

* Hï Ibiza
* Pacha Ibiza

### Mykonos, Greece

* Cavo Paradiso
* Nammos

---

# Firestore Collections

* clubLocations
* events
* templates
* shoutouts
* approvedShoutouts
* users

---

# URL Structure

## Patron

/?location=club-id

Example

/?location=josephine-atlanta-ga

---

## Admin

/admin.html?location=club-id

Example

/admin.html?location=zebbies-garden-washington-dc

---

## Display

/display.html?location=club-id

Example

/display.html?location=shoko-barcelona-beach-club-spain

---

# Firebase Configuration

Required Services

* Authentication
* Firestore
* Storage

Authentication Providers

* Google
* Microsoft
* Facebook
* Phone OTP

---

# Xibo Integration

Display URL:

display.html?location=club-id

Usage:

* Xibo Web Page Widget
* Xibo Layout Playlists
* Xibo Scheduling

---

# LED Hardware Platform

Controllers

* Huidu A4L
* Huidu R712

Displays

* Flexible P1.5 LED Panels

Power

* Portable Battery System
* Direct DC Power Distribution

---

# Roadmap

Planned Features

* Stripe Payments
* Ticketmaster Integration
* Eventbrite Integration
* Resident Advisor Integration
* OpenTable Integration
* QR Club Campaigns
* AI Moderation
* Multi-Club Operators
* White Label Club Portals
* Club Analytics
* Advertising Marketplace

---

# Version History

## v1

Basic Authentication

## v5

Admin Workflow

## v10

Club Search Filters

## v15

Firestore Architecture

## v20

Beach Clubs

Lounge-Clubs

Expanded Venue Database

## v21

Profile Menu

Sponsored Splash Screens

Improved User Experience

Category Redesign

---

# Document Maintenance Policy

This document must be updated whenever:

* New screens are added
* New categories are added
* Firestore schema changes
* URLs change
* Authentication changes
* New venues are added
* Payment providers are integrated
* New releases are deployed

This README-MASTER.md serves as the authoritative functional and technical specification for the Jadz AdCo ShoutOut Platform.
