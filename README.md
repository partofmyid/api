# part-of.my.id API
read only api for querying domain information

## routes

- **GET** `/query/count` - returns registered subdomain count
- **GET** `/query/check/:subdomain` - checks if :subdomain is available
- **GET** `/query/subdomain/:subdomains` - gets records for :subdomains (fetch multiple by coma separating subdomains)
- **GET** `/query/username/:username` - gets subdomains owned by github user :username

> [!NOTE]
> `/git` and `/db` routes are password protected

- **POST** `/git/clone` - clones registration repository
- **POST** `/git/pull` - pulls changes to already cloned repo
- **POST** `/git/rm` - deletes local repository clone directory
- **POST** `/db/sync` - syncs database with registration repository
- **GET** `/db/raw` - gets raw db.json
