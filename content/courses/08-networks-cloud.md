---
slug: networks-and-cloud-basics
title: Computer Networks & Cloud Basics
subtitle: Understand how devices connect, how the internet really works and how cloud services power modern life.
category: network-cloud
level: beginner
hours: 6
featured: false
tags: [networking, internet, wifi, ip address, dns, cloud computing]
outcomes:
  - Describe the main types of networks and the devices that build them
  - Explain IP addresses, DNS and how data travels across the internet
  - Set up and troubleshoot a home or small-office Wi-Fi network
  - Understand cloud computing models and everyday cloud services
  - Choose between local, cloud and hybrid storage sensibly
  - Plan a simple, secure network for a small school or business
requirements:
  - Digital Literacy Essentials or equivalent computer skills
  - Curiosity about how things work — no technical background needed
description: |
  Every time you send a WhatsApp message, pay with mobile money or join a video lesson, your data travels through dozens of networks and data centres in a fraction of a second. Networks and the cloud are the invisible infrastructure of modern life.

  This course explains, in plain language, how networks and the internet work, how to set up and fix Wi-Fi, and what "the cloud" actually is. It is a strong foundation for careers in IT support, network engineering, cloud computing and cybersecurity.
---

# Module: Networking fundamentals
Learn what networks are, the kinds that exist and the equipment that connects them.

## Lesson: What is a network? (8 min)
A **computer network** is two or more devices connected so they can share information and resources. When your phone sends a photo to a friend's phone, or a school's computers print on one shared printer, a network makes it possible.

### Why we build networks
- **Communication** — email, messaging, video calls.
- **Sharing resources** — printers, internet connections, files.
- **Centralised data** — one database that everyone in an organisation can use.
- **Access to services** — websites, banking, mobile money, online learning.

### Types of networks by size
| Type | Name | Example |
|---|---|---|
| **PAN** | Personal Area Network | Your phone connected to Bluetooth earphones or a smartwatch |
| **LAN** | Local Area Network | Computers in a school lab or office |
| **WLAN** | Wireless LAN | Wi-Fi at home or in a café |
| **MAN** | Metropolitan Area Network | A city-wide network linking university campuses |
| **WAN** | Wide Area Network | A bank linking branches across Ghana; the internet is the biggest WAN |

### Wired vs wireless
- **Wired (Ethernet)** — cables; faster, more stable and more secure. Great for desktops, servers and printers.
- **Wireless (Wi-Fi, mobile data)** — convenient and flexible; affected by distance, walls and interference.

### Clients and servers
- A **client** requests a service (your phone asking for a web page).
- A **server** provides it (the computer that stores the website).

In a **peer-to-peer** network, devices share directly with each other without a central server — like sharing files over Bluetooth.

> [!TRY]
> List all the networks you used today (mobile data, Wi-Fi, Bluetooth…). Classify each as PAN, LAN/WLAN or WAN.

## Lesson: Network devices and cables (9 min)
Networks are built from a few key types of equipment.

### The key devices
| Device | What it does |
|---|---|
| **Network Interface Card (NIC)** | The part inside each device that connects it to a network (wired or Wi-Fi) |
| **Switch** | Connects many devices within a LAN and sends data only to the device it's meant for |
| **Router** | Connects different networks together — e.g. your home network to the internet — and chooses the best path for data |
| **Wireless Access Point (WAP)** | Lets Wi-Fi devices join a wired network |
| **Modem** | Converts signals between your internet provider's line and your network |
| **Firewall** | Filters traffic to block unwanted or dangerous connections |

The small box many homes in Ghana get from their internet provider is usually **all-in-one**: modem + router + switch + Wi-Fi access point.

### MiFi and mobile routers
A **MiFi** or 4G router uses a SIM card to share mobile data over Wi-Fi with several devices — popular where fixed broadband isn't available.

### Cables
- **Ethernet (twisted pair, e.g. Cat5e/Cat6)** — the common network cable with an RJ45 plug. Supports up to 1 Gbps or more over up to 100 metres.
- **Fibre optic** — sends data as light through glass strands. Extremely fast and works over long distances; used for undersea internet cables reaching West Africa and increasingly for homes and offices.
- **Coaxial** — used by some cable TV and internet services.

### Network topologies
**Topology** describes how devices are arranged.
- **Star** — every device connects to a central switch. Most common; if one cable fails, only that device is affected.
- **Bus** — all devices on a single cable (old; a single break stops everything).
- **Ring** — devices connected in a circle.
- **Mesh** — many interconnections for reliability; modern **mesh Wi-Fi** systems use several units to cover large homes.

> [!TIP]
> Fibre optic cables under the sea connect Ghana to Europe and the rest of the world. When one is damaged, internet in the whole region can slow down — as happened in West Africa in 2024.

> [!TRY]
> Look at your home or school internet box. Find its brand, the lights on it, and the ports at the back. Which are Ethernet ports?

## Lesson: IP addresses and how data travels (10 min)
### IP addresses
Every device on a network needs an address, just as every house needs an address for post. This is its **IP (Internet Protocol) address**.

- **IPv4** looks like `192.168.1.25` — four numbers from 0 to 255. There are only about 4.3 billion IPv4 addresses, which isn't enough for every device on Earth.
- **IPv6** looks like `2001:0db8:85a3::8a2e:0370:7334` — vastly more addresses.

### Private and public addresses
- **Private IP addresses** (such as `192.168.x.x` or `10.x.x.x`) are used inside your home or office network.
- **Public IP addresses** are used on the internet. Your router has one public address and shares it with all your devices using **NAT (Network Address Translation)**.

### DHCP: automatic addresses
You rarely type IP addresses yourself. A **DHCP** server (usually built into your router) automatically gives each device an IP address when it joins the network.

### Packets
Data doesn't travel as one big piece. It's split into small **packets**. Each packet carries part of the data plus the destination and source addresses. Packets may take different routes and are put back together in order when they arrive. If one is lost, it's sent again.

### Protocols
A **protocol** is a set of rules for communication. Important ones:
- **TCP/IP** — the core rules of the internet: IP handles addressing and routing; TCP makes sure data arrives completely and in order.
- **HTTP / HTTPS** — for web pages (HTTPS is encrypted).
- **DNS** — turns names into IP addresses.
- **SMTP / IMAP** — for sending and receiving email.

### Ports
One device runs many services. **Ports** are like apartment numbers at the same address: websites use port **443** (HTTPS) or **80** (HTTP).

> [!TRY]
> On Windows, open Command Prompt and type `ipconfig`. On Android, go to **Settings → About phone → Status** (or Wi-Fi details). Find your device's private IP address.

## Quiz: Practice — network basics {kind=practice pass=60}
### Q: What type of network connects computers in a single school lab?
- [ ] WAN
- [x] LAN
- [ ] PAN
- [ ] MAN
> A Local Area Network covers a small area such as a building.

### Q(tf): A router connects different networks together, such as your home network and the internet.
= true
> Routers move data between networks.

### Q: Which is a private IPv4 address?
- [x] 192.168.1.10
- [ ] 8.8.8.8
- [ ] 300.1.1.1
- [ ] 2001:db8::1
> 192.168.x.x is a private range; 300 isn't valid in IPv4.

## Quiz: Module 1 quiz — Networking fundamentals {pass=70}
### Q: Which device connects many computers within a LAN and sends data only to the intended device?
- [ ] Modem
- [x] Switch
- [ ] Projector
- [ ] Firewall
> Switches forward data to the correct device on a local network.

### Q: What automatically assigns IP addresses to devices joining a network?
- [ ] DNS
- [x] DHCP
- [ ] HTTPS
- [ ] NAT
> DHCP hands out addresses automatically.

### Q: Why is data split into packets?
- [ ] To make files bigger
- [x] So data can travel efficiently and be resent in parts if something is lost
- [ ] Because cables only carry one letter at a time
- [ ] To hide it from the router
> Packets can take different routes and be reassembled at the destination.

### Q(multiple): Which are advantages of wired Ethernet over Wi-Fi?
- [x] Usually faster
- [x] More stable
- [x] Harder to intercept
- [ ] Easier to move around with
> Wi-Fi wins on mobility; wired wins on speed and stability.

### Q(short): Which port number is used by HTTPS websites? (number)
= 443
> HTTPS uses port 443; plain HTTP uses port 80.

# Module: The internet and Wi-Fi
Understand how the internet is organised and how to run a good Wi-Fi network.

## Lesson: How the internet works (9 min)
The **internet** is a global network of networks — millions of private, public, academic, business and government networks linked together.

### Internet Service Providers (ISPs)
You connect to the internet through an **ISP** — a mobile network or broadband company. ISPs connect to bigger networks, which connect to each other at **Internet Exchange Points (IXPs)**. Ghana has an internet exchange (GIX) in Accra, so local traffic between Ghanaian networks doesn't have to travel abroad, making it faster and cheaper.

### Undersea cables
Most international internet traffic travels through **undersea fibre optic cables**. Several major cables land on Ghana's coast, connecting West Africa to Europe and beyond. Satellites provide internet in some remote areas but are generally slower and more expensive per megabyte.

### DNS — the internet's phone book
Computers find each other with IP addresses, but humans prefer names. When you type `dbi-learn.pages.dev`:

1. Your device asks a **DNS resolver** (usually your ISP's, or a public one like Google's `8.8.8.8` or Cloudflare's `1.1.1.1`).
2. The resolver finds which server is responsible for that name.
3. It returns the IP address.
4. Your browser connects to that IP address.

This usually takes a few milliseconds and is cached so it's even faster next time.

### What is bandwidth? What is latency?
- **Bandwidth** — how much data can be sent per second (measured in Mbps). Like the width of a road.
- **Latency** — how long it takes data to travel (measured in milliseconds, ms). Like the time to drive the road.

Video streaming needs bandwidth; video calls and online games need low latency.

> [!TIP]
> Use a speed test (e.g. fast.com or speedtest.net) to check your connection. Test at different times of day — networks are often slower in the evening when many people are online.

> [!TRY]
> Run a speed test on your phone and write down your download speed, upload speed and latency (ping).

## Lesson: Setting up a secure Wi-Fi network (9 min)
A well-configured Wi-Fi network is fast, reliable and safe.

### Placement matters
- Place the router **centrally** and **high up**, away from thick walls, metal objects and microwaves.
- Concrete block walls — common in Ghanaian buildings — weaken Wi-Fi signals a lot. Large buildings may need **extenders** or **mesh** systems.

### 2.4 GHz vs 5 GHz
Most routers broadcast on two bands:
- **2.4 GHz** — longer range, goes through walls better, but slower and more crowded.
- **5 GHz** — faster with less interference, but shorter range.

### Secure configuration checklist
1. **Change the admin password** of the router (the default password is often printed on the box or easy to find online).
2. Use **WPA2** or, better, **WPA3** encryption. Never leave a network open.
3. Set a **strong Wi-Fi password** (at least 12 characters).
4. Change the network name (**SSID**) to something that doesn't reveal personal information.
5. Turn off **WPS** (a convenience feature that's easier to attack).
6. Create a **guest network** for visitors, separate from your main devices.
7. **Update the router firmware** when updates are available.

### Logging in to the router
Type the router's address (often `192.168.0.1` or `192.168.1.1`) into a browser on a connected device, and log in with the admin credentials printed on the router's label. Change them immediately.

> [!WARNING]
> Anyone with your Wi-Fi password can use your data and may be able to see other devices on your network. Share it only with people you trust, and use a guest network for visitors.

> [!TRY]
> If you have access to a router, check what security type it uses (WPA2/WPA3) and whether a guest network is available.

## Lesson: Troubleshooting network problems (9 min)
"The internet isn't working" is the most common IT support request. A systematic approach finds the problem quickly.

### Step 1: Define the problem
- Is it **one device** or **all devices**?
- Is it **one website/app** or **everything**?
- Did it ever work? What changed?

### Step 2: Check the basics (fixes most problems)
- Is Wi-Fi / mobile data turned on? Is **Airplane mode** off?
- Is there **data on the bundle**?
- Are the router's lights normal? Are the cables plugged in?
- **Restart** the device and the router (unplug for 30 seconds).

### Step 3: Work through the layers
| Symptom | Likely cause | Try |
|---|---|---|
| No Wi-Fi networks visible | Wi-Fi off on device or router | Turn Wi-Fi on; restart router |
| Connected to Wi-Fi but "No internet" | Problem between router and ISP | Restart router; check ISP outage or bundle |
| Some websites don't load | DNS problem or the site is down | Try another site; change DNS to 1.1.1.1 |
| Very slow | Weak signal, congestion, or data throttling | Move closer; use 5 GHz; test speed |
| One device can't connect | Wrong password, device issue | "Forget" the network and reconnect |

### Useful tools
- `ping google.com` — checks whether you can reach a server and how fast (latency).
- `ipconfig` (Windows) / `ifconfig` or `ip a` (Mac/Linux) — shows your IP settings.
- `tracert google.com` (Windows) — shows each step (hop) data takes.
- Speed tests — measure bandwidth.

### Document and communicate
In a workplace, write down what you found and what fixed it. If you need to call the ISP, give clear details: "All devices connect to Wi-Fi but have no internet since 9am; the router's internet light is red; restarting didn't help."

> [!TIP]
> If you can `ping 8.8.8.8` (an IP address) but not `ping google.com` (a name), the problem is DNS.

> [!TRY]
> Open a command prompt and run `ping google.com`. Note the time in milliseconds. Try again on a different network and compare.

## Quiz: Module 2 quiz — Internet and Wi-Fi {pass=70}
### Q: What does DNS do?
- [ ] Encrypts Wi-Fi
- [x] Translates domain names into IP addresses
- [ ] Assigns IP addresses automatically
- [ ] Measures internet speed
> DNS is the internet's phone book.

### Q: Which Wi-Fi security setting is most secure?
- [ ] Open (no password)
- [ ] WEP
- [x] WPA3
- [ ] WPS
> WPA3 is the newest and strongest standard; WPA2 is acceptable.

### Q: Your phone is connected to Wi-Fi but says "No internet". All other devices have the same problem. What should you check first?
- [ ] Buy a new phone
- [x] Restart the router and check the ISP connection or data
- [ ] Delete your apps
- [ ] Change the phone's wallpaper
> When all devices fail, the problem is likely the router or the ISP.

### Q(tf): The 5 GHz Wi-Fi band generally has a longer range than 2.4 GHz.
= false
> 2.4 GHz has longer range; 5 GHz is faster but shorter range.

### Q(multiple): Which steps make a home router more secure?
- [x] Change the default admin password
- [x] Use WPA2/WPA3 with a strong password
- [x] Update the router firmware
- [ ] Share the Wi-Fi password on social media
> Strong credentials, encryption and updates protect your network.

# Module: Cloud computing
Understand what the cloud is and how people and businesses use it.

## Lesson: What is the cloud? (9 min)
**Cloud computing** means using computing resources — storage, processing power, software — over the internet, instead of owning and running them on your own computer.

"The cloud" isn't in the sky. It's huge buildings called **data centres**, filled with thousands of powerful servers, run by companies such as Amazon Web Services (AWS), Microsoft Azure and Google Cloud. Major cloud providers already run data centres in South Africa, and more data centres are being built across the continent, including in West Africa.

### You already use the cloud
- **Gmail / Outlook** — your email lives on cloud servers.
- **Google Drive / OneDrive / iCloud** — cloud storage for files and photos.
- **WhatsApp backups** — stored in Google Drive or iCloud.
- **Netflix / YouTube** — streaming from cloud data centres.
- **DBI Learn** — this platform runs on cloud services!

### Key characteristics of cloud computing
- **On-demand** — get resources whenever you need them, without buying hardware.
- **Accessible anywhere** — from any device with internet.
- **Scalable** — easily grow (or shrink) to handle more users.
- **Pay-as-you-go** — pay only for what you use (many services have free tiers).
- **Managed** — the provider handles hardware, power, cooling and much of the security.

### Benefits and challenges
| Benefits | Challenges |
|---|---|
| No big upfront hardware cost | Needs a reliable internet connection |
| Automatic backups and updates | Ongoing costs can grow |
| Work from anywhere, collaborate easily | You depend on the provider |
| Scale quickly | Data privacy and where data is stored |

> [!NOTE]
> Offline-capable apps (like DBI Learn's downloadable courses) combine the best of both: data lives in the cloud, but you can keep working without a connection and sync later.

> [!TRY]
> List five cloud services you use. For each, write what would happen if it went offline for a day.

## Lesson: Cloud service models: IaaS, PaaS and SaaS (9 min)
Cloud services come in three main models, depending on how much the provider manages for you.

### The pizza analogy
| Model | Pizza version | You manage | Provider manages |
|---|---|---|---|
| **On-premises** | Make pizza at home | Everything | Nothing |
| **IaaS** — Infrastructure as a Service | Take-and-bake: buy the base, bake it yourself | Operating system, apps, data | Servers, storage, networking |
| **PaaS** — Platform as a Service | Pizza delivered; you set the table | Your app and data | Infrastructure + operating system + runtime |
| **SaaS** — Software as a Service | Eat at the restaurant | Just your data and settings | Everything else |

### Examples
- **SaaS:** Gmail, Microsoft 365, Canva, Zoom, Google Classroom — you just log in and use the software.
- **PaaS:** platforms where developers deploy apps without managing servers — e.g. Google App Engine, Heroku, Supabase, Cloudflare Pages.
- **IaaS:** renting virtual machines and storage — e.g. Amazon EC2, Azure Virtual Machines, Google Compute Engine.

### Deployment models
- **Public cloud** — shared infrastructure from providers like AWS, Azure, Google Cloud.
- **Private cloud** — infrastructure dedicated to one organisation (e.g. a bank's own data centre).
- **Hybrid cloud** — a mix: sensitive systems on-premises, other workloads in the public cloud.

### Who's responsible for security?
In the cloud, security is **shared**. The provider secures the physical data centre and infrastructure; you're always responsible for your **accounts, passwords, data and who you share it with**. Most cloud data leaks happen because of weak passwords or files accidentally shared publicly — not because the provider was hacked.

> [!TRY]
> Classify these as IaaS, PaaS or SaaS: Google Docs, a rented virtual server, a platform that runs your website code automatically, Zoom.

## Lesson: Using cloud storage and collaboration well (8 min)
### Choosing where to keep files
| Option | Best for |
|---|---|
| **Local storage** (laptop, phone, flash drive) | Working offline; large files; when data is very sensitive |
| **Cloud storage** (Google Drive, OneDrive, Dropbox) | Access from anywhere; sharing; automatic backup |
| **Both (hybrid)** | Important work — keep a local copy *and* a cloud copy |

### Getting the most from cloud storage
- **Sync** a folder so files are automatically backed up.
- Use **offline mode** in Google Drive/Docs to keep important files available without internet.
- Save data by syncing on **Wi-Fi only**.
- Organise with clear folders, just like on your computer.

### Sharing safely
- Share with specific people (by email) whenever possible.
- Choose the right permission: **Viewer**, **Commenter** or **Editor**.
- Avoid "Anyone with the link" for personal or confidential files.
- Regularly review "Shared with me" and "Shared by me" and remove old access.

### Real-time collaboration
Google Docs, Sheets and Slides and Microsoft 365 let several people edit the same file at once. Use:
- **Comments** and **@mentions** to ask questions.
- **Suggesting mode** to propose changes without overwriting.
- **Version history** to see who changed what and restore earlier versions.

### Managing storage limits
Free plans have limits (Google gives 15 GB shared across Gmail, Drive and Photos). Free up space by deleting large old videos and email attachments, and by emptying the trash.

> [!TRY]
> Create a shared Google Doc with a classmate, use comments to discuss one paragraph, and then open **Version history** to see each person's edits.

## Quiz: Module 3 quiz — Cloud computing {pass=70}
### Q: Where does "the cloud" physically exist?
- [ ] In satellites only
- [ ] Inside your phone
- [x] In data centres full of servers
- [ ] Nowhere — it's not physical
> Cloud services run on servers in large data centres.

### Q: Gmail and Canva are examples of which cloud model?
- [ ] IaaS
- [ ] PaaS
- [x] SaaS
- [ ] On-premises
> SaaS means ready-to-use software accessed over the internet.

### Q: Renting a virtual server that you install your own operating system on is…
- [x] IaaS
- [ ] SaaS
- [ ] Peer-to-peer
- [ ] A LAN
> Infrastructure as a Service provides raw computing resources.

### Q(multiple): Which are benefits of cloud computing?
- [x] Access from anywhere with internet
- [x] Scalability
- [x] Pay only for what you use
- [ ] Works perfectly with no internet connection ever
> The cloud depends on connectivity, which is why offline features matter.

### Q(tf): In the cloud, the provider is responsible for keeping your account password safe.
= false
> Security is shared; you are responsible for your accounts and sharing settings.

# Module: Putting it together
Plan and support a real-world network.

## Lesson: Planning a network for a small school or business (10 min)
Let's design a network for a small community school with a 20-computer lab, an office and Wi-Fi for teachers.

### 1. Gather requirements
- How many users and devices? (20 lab PCs, 5 office PCs, 15 teacher phones/laptops, 2 printers)
- What will they use it for? (online learning, research, administration, printing)
- What's the budget?
- Where is internet available? (fibre, 4G router, satellite)
- Who will maintain it?

### 2. Design
- **Internet connection** from an ISP, with a router/firewall at the edge.
- A **switch** in the lab with Ethernet cables to each desktop (more reliable than Wi-Fi for 20 PCs).
- **Wi-Fi access points** for teachers, placed centrally in the staff room and corridors.
- **Separate networks (VLANs or SSIDs)**: Office (admin data), Lab (students), Staff Wi-Fi, Guest Wi-Fi. Students shouldn't be able to reach the office computers.
- A **UPS (uninterruptible power supply)** for the router and switch so short power outages don't drop everyone offline — important where *dumsor* (power cuts) happen.

### 3. Security
- Strong Wi-Fi passwords and WPA2/WPA3.
- Content filtering for students where appropriate.
- Antivirus and automatic updates on all PCs.
- Individual logins for staff; nothing shared.
- Regular backups of office data to the cloud and an external drive.

### 4. Save bandwidth
- Download large updates once and share them locally where possible.
- Use offline-capable learning platforms (like DBI Learn downloads) so learners don't all stream at once.
- Schedule big downloads for off-peak hours.

### 5. Document everything
Draw a simple **network diagram**, label every device and cable, and record passwords securely (not on a sticky note on the router!).

> [!TRY]
> Draw a network diagram for your school, church or a small business you know, showing the internet connection, router, switch, access points and devices.

## Lesson: Careers in networking and cloud (8 min)
Every organisation that uses computers needs people who can keep networks and cloud systems running. Demand is growing across Africa as businesses digitise.

### Common roles
- **IT Support Technician** — helps users, fixes computers, sets up devices and networks. A great first job.
- **Network Administrator** — manages an organisation's routers, switches, Wi-Fi and firewalls.
- **Network Engineer** — designs and builds larger networks for ISPs, banks and telecoms.
- **Cloud Engineer / Cloud Administrator** — builds and manages systems on AWS, Azure or Google Cloud.
- **DevOps Engineer** — automates how software is built, tested and deployed to the cloud.
- **Data Centre Technician** — installs and maintains servers and cabling.

### Skills to build
- Networking concepts (this course!), then deeper topics like subnetting and routing.
- **Linux** command line basics.
- One cloud platform's fundamentals.
- Scripting with **Python** (see our Python course).
- Soft skills: clear communication, patience and documentation.

### Free learning and certifications
- **Cisco Networking Academy** — free courses including Networking Basics and Introduction to IoT.
- Cloud providers offer free fundamentals training: **AWS Skill Builder**, **Microsoft Learn** (Azure Fundamentals), **Google Cloud Skills Boost**.
- Entry-level certifications: CompTIA A+ / Network+, Cisco CCNA, AWS Certified Cloud Practitioner, Microsoft Azure Fundamentals (AZ-900).

### Get practical experience
- Volunteer to help maintain your school or church computer lab.
- Set up and document a home network.
- Use cloud free tiers to host a small website.
- Build a home lab with old computers and free tools like Cisco Packet Tracer (a network simulator).

> [!TRY]
> Choose one role that interests you and plan your next three learning steps with dates.

## Lesson: Review — following data around the world (8 min)
Let's trace what happens when Ama, in Ho, opens a DBI Learn lesson on her phone using home Wi-Fi.

1. **Wi-Fi (WLAN):** Her phone's network card sends a request over 5 GHz Wi-Fi to the home router, using its private IP address (e.g. `192.168.1.23`) assigned by **DHCP**.
2. **DNS:** The phone asks a DNS resolver for the IP address of the DBI Learn website.
3. **NAT:** The router replaces Ama's private address with its own **public IP address** and forwards the request to the **ISP**.
4. **Routing:** Routers across the ISP's network and the internet forward the **packets** hop by hop — possibly through the Ghana Internet Exchange or an undersea fibre cable to a data centre.
5. **HTTPS:** The connection is encrypted with **TLS**, so nobody along the way can read the lesson or her password.
6. **Cloud:** A server in a **cloud data centre** (a PaaS/serverless platform) responds with the page; the lesson data comes from a cloud database.
7. **Return trip:** Packets travel back, are reassembled by **TCP**, and the browser renders the lesson.
8. **Offline:** Ama taps **Download** — the lesson is saved on her phone, so tomorrow she can study with no data at all. Her progress syncs to the cloud when she reconnects.

All of this happens in well under a second, thousands of times a day.

> [!TIP]
> Being able to explain this journey clearly — in an interview or to a customer — shows real understanding of networks and the cloud.

> [!TRY]
> Write your own version of this journey for sending a WhatsApp photo to a friend in another town.

## Quiz: Module 4 quiz — Putting it together {pass=70}
### Q: Why should a school lab's student network be separated from the office network?
- [ ] To make the internet faster
- [x] So students can't access confidential office data
- [ ] Because switches require it
- [ ] To save electricity
> Network separation limits who can reach sensitive systems.

### Q: What does a UPS do for network equipment?
- [ ] Speeds up Wi-Fi
- [x] Keeps it powered during short power cuts
- [ ] Encrypts data
- [ ] Assigns IP addresses
> An uninterruptible power supply provides battery backup.

### Q(multiple): Which are good entry-level paths into networking and cloud careers?
- [x] IT support technician roles
- [x] Free Cisco Networking Academy courses
- [x] Cloud provider fundamentals training
- [ ] Testing other people's networks without permission
> Legal, practical learning and entry roles build experience.

### Q: In Ama's journey, what replaces her phone's private IP with the router's public IP?
- [ ] DNS
- [ ] DHCP
- [x] NAT
- [ ] HTTPS
> Network Address Translation lets many devices share one public address.

### Q(tf): Using offline-capable learning apps can reduce bandwidth use in a school lab.
= true
> Downloading once and studying offline avoids many simultaneous streams.

# Final: Final exam — Computer Networks & Cloud Basics {pass=70 attempts=3 time=25}
### Q: A bank connects branches in Accra, Kumasi and Tamale. What type of network is this?
- [ ] PAN
- [ ] LAN
- [x] WAN
- [ ] WLAN
> A Wide Area Network spans large geographic distances.

### Q: Which device is MOST responsible for connecting your home network to the internet?
- [ ] Switch
- [x] Router
- [ ] Printer
- [ ] Monitor
> Routers move data between your network and the ISP.

### Q: Which is an IPv4 address?
- [x] 10.0.0.5
- [ ] 2001:db8::1
- [ ] www.example.com
- [ ] 00:1A:2B:3C:4D:5E
> IPv4 has four numbers 0–255; the others are IPv6, a domain name and a MAC address.

### Q: You can reach 8.8.8.8 with ping, but websites won't load by name. What is the likely problem?
- [ ] The cable is broken
- [x] DNS isn't working
- [ ] The monitor is off
- [ ] Your password expired
> If IP connectivity works but names fail, DNS is the issue.

### Q(multiple): Which actions improve Wi-Fi coverage in a large concrete building?
- [x] Placing the router centrally and high
- [x] Adding a mesh system or access points
- [ ] Hiding the router inside a metal cabinet
- [x] Using wired Ethernet for fixed computers
> Placement, extra access points and cables help; metal blocks signals.

### Q: What is the difference between bandwidth and latency?
- [x] Bandwidth is how much data per second; latency is how long data takes to travel
- [ ] They are the same thing
- [ ] Latency is how much data; bandwidth is the delay
- [ ] Bandwidth only applies to Wi-Fi
> Think of bandwidth as road width and latency as travel time.

### Q: Google Drive and Microsoft 365 are examples of…
- [ ] IaaS
- [ ] PaaS
- [x] SaaS
- [ ] LANs
> They are ready-to-use software delivered over the internet.

### Q(tf): In cloud computing, users are still responsible for securing their accounts and sharing settings.
= true
> This is the shared responsibility model.

### Q: Which Wi-Fi setting should you disable because it's easier to attack?
- [ ] WPA3
- [x] WPS
- [ ] Guest network
- [ ] Firmware updates
> WPS is a convenience feature with known weaknesses.

### Q: What does DHCP do?
- [ ] Encrypts web traffic
- [x] Automatically assigns IP addresses to devices
- [ ] Translates names to IP addresses
- [ ] Blocks viruses
> DHCP hands out IP settings automatically.

### Q(short): Which protocol makes sure data arrives completely and in the right order? (abbreviation)
= TCP | tcp | transmission control protocol
> TCP handles reliable, ordered delivery; IP handles addressing.

### Q: A business keeps sensitive payroll data on its own servers but runs its website in the public cloud. This is…
- [ ] Public cloud only
- [ ] Private cloud only
- [x] Hybrid cloud
- [ ] Peer-to-peer
> Hybrid cloud combines on-premises/private resources with public cloud.
