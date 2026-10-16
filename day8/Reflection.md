# Day 8 Reflection

## The hardest concept

Scaling (Day 7) was the hardest. Words like "cache" and "load balancer" felt like a list to memorise. The arithmetic fixed that. For the URL shortener, 100 million redirects a day divided by 100,000 seconds is about 1,000 reads per second, against 10 writes per second. That showed where the system breaks first. I stopped memorising parts and asked which problem each part solves.

## What I learned

- **Day 1:** Opening a page is a conversation. The browser asks, the server answers, and HTML is the skeleton of the answer.
- **Day 2:** CSS lets one page rearrange itself for a phone and for a desktop.
- **Day 3:** A function packs repeated steps into one named tool.
- **Day 4:** Browser storage lets a page remember data after a refresh.
- **Day 5:** Status codes are short replies. POST creates, and 404 means not found.
- **Day 6:** A primary key gives each row one identity, and relationships link tables without copying data.
- **Day 7:** Every added component creates a new problem. A cache can serve stale data, and replicas lag.

## What I would improve in my capstone

Feedback I received: a classmate wished I had shown the request in the Network tab when I created a note. I would add that step to my demo: create a note, open the Network tab, and point to the POST request and its 201 response. The API section would then be proven live, not only described.

## What I will learn next

I will learn Node.js and Express to turn my API design into working code. Then I will learn PostgreSQL to store QuickNotes for real users.