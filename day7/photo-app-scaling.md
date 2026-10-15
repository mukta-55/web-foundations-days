# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- 10,000,000 registered users.
- 10% of them are active each day, so there are 1,000,000 daily active users (DAU).
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day. I count each feed page view as one request.
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail.
- One day is about 100,000 seconds (rounded for easy maths). Peak traffic is 5 times the average.

## 2. Estimates

**Uploads per second**

- 1,000,000 users x 1 photo = 1,000,000 uploads per day.
- 1,000,000 / 100,000 = about **10 uploads per second** on average.
- Peak: 10 x 5 = about **50 uploads per second**.

**Feed views per second**

- 1,000,000 users x 50 views = 50,000,000 feed views per day.
- 50,000,000 / 100,000 = about **500 feed views per second** on average.
- Peak: 500 x 5 = about **2,500 feed views per second**.

**Storage per year**

- Each upload stores a 2 MB photo plus a 50 KB thumbnail, which is about 2.05 MB.
- 1,000,000 uploads x 2.05 MB = about 2.05 TB per day.
- 2.05 TB x 365 = about **750 TB per year** (730 TB of photos and about 18 TB of thumbnails).

## 3. Read-heavy or write-heavy?

The system is **read-heavy**. There are 500 feed views per second against 10 uploads per second on average, so reads outnumber uploads by 50 to 1. This means the design should focus on making reads fast and cheap. Feed data should be cached, a read replica should handle database reads, and a CDN should serve the photos and thumbnails so most reads never reach our own servers. Writes still matter, because every upload also creates a thumbnail job, but at about 10 per second they are manageable.

## 4. Why photos should not be stored in the database

A 2 MB photo is far larger than a typical database row, and 750 TB per year of photo data would make the database huge, slow to back up and expensive to replicate. Databases are built to search and relate small structured values, not to serve big files. Photos should go in **object storage** (such as Amazon S3), which is designed for large files and is cheap and durable. The database stores only a link (the file's location) to each photo and thumbnail, together with the details such as the owner and upload time. This matches the Day 6 rule that file or object storage keeps large files and the database stores only a link.

## 5. Architecture diagram

```
Users / clients ---> DNS (snapshare.com -> IP addresses)
      |
      |--- photos, thumbnails, front end ---> CDN (edge servers) --(miss)--> Object storage
      |
      v
Load balancer
   |        |        |
   v        v        v
App 1     App 2     App 3  -----> Cache (Redis)
   |          |           |
 writes     reads       jobs
   |          |           |
   v          v           v
Primary DB --> Read replica     Queue ---> Worker (makes thumbnails)
                                              |
                                              v
                                       Object storage
```

## 6. What each component does

- **Users / clients:** the browsers and phone apps people use to upload photos and scroll the feed.
- **DNS:** turns the name snapshare.com into the IP addresses of our servers, so users can find us.
- **CDN:** keeps copies of photos, thumbnails and the front-end files on edge servers close to users, which reduces latency and takes load off our own servers.
- **Load balancer:** spreads requests across the app servers and stops sending traffic to any server that fails a health check, so no single server is a single point of failure.
- **App servers (at least 2):** run the application code, check who the user is and apply the rules. They keep no data of their own, so any server can handle any request.
- **Cache (Redis):** keeps recently built feeds in memory, so the most common reads are answered in about 1 ms without touching the database.
- **Primary database:** stores the details about users, photos (including the link to each file) and follows, and accepts every write.
- **Read replica:** holds a copy of the primary and answers feed reads, so the primary is free to handle writes, and it can be promoted if the primary fails.
- **Object storage:** holds the photo and thumbnail files cheaply and durably, because the database is the wrong place for large files.
- **Queue:** holds the thumbnail jobs, so the app can answer the user immediately and a burst of uploads waits in line instead of overloading the system.
- **Worker:** takes jobs from the queue and creates the 50 KB thumbnails in the background.

## 7. Upload flow, step by step

1. The user picks a photo in the app, and the app sends it to the API over HTTPS.
2. The load balancer forwards the request to a healthy app server.
3. The app server checks the user's token and validates the upload (for example the file type and size).
4. The app server saves the photo file in object storage.
5. The app server writes a row to the primary database with the owner, the time and the link to the stored photo.
6. The app server adds a "create thumbnail" job to the queue.
7. The app server deletes that user's cached feed entries in Redis, so stale data is never served.
8. The app server replies "201 Created" to the user straight away.
9. A worker takes the job from the queue, reads the photo from object storage, makes a 50 KB thumbnail and saves it in object storage.
10. The worker updates the photo's row in the database with the link to the thumbnail, and the primary copies the change to the read replica a few milliseconds later.

## 8. Trade-offs

- **Speed versus freshness (cache and replica):** the cache and the read replica make the feed fast, but a follower may see a new photo a moment late, because the cache is only cleared on a change and the replica copies data a few milliseconds after the primary. This is acceptable for a photo feed, where a slightly old feed does no harm.
- **Simplicity versus scalability:** a single server would be simpler to build and run, but it would be a single point of failure and could not handle 2,500 feed views per second at peak. The multi-server design is more complex to build and run, but it keeps working if one server fails.
- **Cost versus reliability:** extra app servers, a read replica and a CDN cost more money, but they keep the service available and fast. About 750 TB of new storage per year is a major cost, which is why cheap object storage is used for the files and not the database.
