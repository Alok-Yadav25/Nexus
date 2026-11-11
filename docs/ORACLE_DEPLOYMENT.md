# Oracle Always Free deployment

Status: deployment preparation only. No Oracle resources or public application have been provisioned. Oracle account signup/sign-in is required before capacity, account quotas or a live deployment can be verified.

## Free resource budget

Checked on 11 November 2026 against [Oracle's Always Free resource documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). The published Always Free Ampere allowance is 1,500 OCPU-hours and 9,000 GB-hours per month, described as equivalent to two OCPUs and 12 GB RAM. Total Always Free block storage is 200 GB across eligible boot/data volumes. Existing resources count toward the same account allowance.

Use one **VM.Standard.A1.Flex**, with **2 OCPUs, 12 GB RAM and a 50 GB boot volume**, only when the console confirms Always Free eligibility and the account has sufficient remaining allocation. Use an ARM64 Ubuntu LTS image. Do not substitute a paid shape, upgrade to Pay As You Go or allocate resources beyond the free allowance if capacity is unavailable. The temporary trial credit is separate from Always Free resources.

The full stack runs on that one VM: Next.js, Spring Boot, FastAPI, PostgreSQL, Redis, Neo4j, Qdrant and Caddy. No managed database, load balancer or NAT gateway is required for this topology.

## Compatibility evidence

The Docker Registry manifests for Node 22 Alpine, PostgreSQL 17 Alpine, Redis 8 Alpine, Neo4j 5 Community, Qdrant v1.16.3, Maven 3.9.11 / Temurin 21, Temurin 21 JRE, Python 3.12 slim and Caddy 2 Alpine all advertise `linux/arm64` images. PyPI release metadata supplies compatible Python 3.12 / Linux ARM64 wheels for all 73 pinned packages, including the native embedding dependencies.

These checks establish artifact availability, not a successful ARM build or runtime deployment. The actual VM must still build the images and pass health, account, source retrieval, graph/vector indexing and browser checks.

## Network and SSH

Create a public subnet with an Internet Gateway. Restrict SSH TCP/22 to the operator's public IP. Permit public inbound TCP/80 and TCP/443 for Caddy. Keep the database and application API ports private; the base Compose file binds their host ports to loopback.

Use a dedicated SSH key. Keep its private half local, out of Git and out of chat. Confirm the server host-key fingerprint from Oracle before trusting a first SSH connection. Account creation, password entry and acceptance of Oracle's terms are handled by the account owner.

## VM preparation

Install Docker Engine and the Compose plugin from [Docker's official Ubuntu apt repository](https://docs.docker.com/engine/install/ubuntu/). Docker supports ARM64 Ubuntu. Install Git and Python 3 through Ubuntu's package manager. Avoid using the local development launcher for public hosting.

Run the application as the normal Ubuntu operator account, using `sudo docker` where Docker permissions require it:

```sh
git clone https://github.com/Alok-Yadav25/Nexus.git
cd Nexus
python3 infrastructure/scripts/init_env.py
```

This creates fresh server credentials in a private `.env`; do not copy development credentials or databases to the public server. Preserve this file across deployments. Record the generated bootstrap administrator password privately. The default bootstrap account email is `admin@nexus.local`.

## Public hostname and HTTPS

Use an existing domain whose A record points to the VM. A no-purchase alternative is a hostname such as `nexus.PUBLIC-IP.sslip.io`, replacing `PUBLIC-IP` with the VM's actual public IPv4 address. [sslip.io / nip.io](https://sslip.io/) resolves embedded IP addresses and supports obtaining public TLS certificates. It is a third-party DNS dependency and shares certificate rate limits; a domain you control provides more operational control.

Add this line to the server's `.env` using the actual DNS hostname, without a scheme or path:

```dotenv
NEXUS_HOSTNAME=nexus.PUBLIC-IP.sslip.io
```

Optionally set a real `NEXUS_RESEARCH_CONTACT`. Groq remains optional and is not enabled with a paid account or copied development key automatically. If desired, configure its server-only key and request budget privately on this VM.

The Oracle override supplies matching HTTPS values for `SITE_URL` and `FRONTEND_ORIGIN`; the production override enables secure cookies and HTTPS headers. Only Caddy publishes public ports. Caddy stores certificates in persistent volumes and automatically redirects HTTP to HTTPS. See [Caddy's hostname and certificate requirements](https://caddyserver.com/docs/automatic-https).

```sh
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.oracle.yml config --quiet

sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.oracle.yml \
  up -d --build --wait --wait-timeout 900
```

The first build and embedding-model download can take several minutes on two OCPUs. The Oracle override bounds container log growth and Neo4j page-cache memory. Persistent databases, model/checkpoint data and TLS state use named volumes.

## Verify before handing over

- Confirm the canonical HTTPS URL loads with a publicly trusted certificate and HTTP redirects to it.
- Confirm secure-cookie registration/sign-in, live Wikipedia search/reading, public article metadata, source evidence, planetary and molecular viewers.
- Check backend health from the VM and actual graph/vector indexing status. Wait for the real embedding model; never replace unavailable embeddings with fake vectors.
- Inspect container health/restart counts and CPU/memory use under representative interactions. ARM runtime support remains unverified until this passes on the actual server.
- Create an encrypted PostgreSQL backup outside the repository and verify its recovery procedure. Retain server credentials privately.

A fresh deployment starts with the attributed starter corpus; local accounts, reading lists and private research records are not migrated by these commands. See [deployment and recovery](DEPLOYMENT.md) and [security boundaries](SECURITY.md).
