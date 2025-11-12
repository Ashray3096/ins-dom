# Where to View Your Deployed Pipelines

## 🎯 Quick Answer

After deploying a pipeline, you can view it in **4 places**:

1. **Inspector Dom UI** (http://localhost:3000) - Deployment info & status
2. **Supabase Database** - Stored Python code and metadata
3. **Local Filesystem** - Deployed Python files
4. **Dagster UI** (http://localhost:3001) - Run & monitor pipelines

---

## 1. 📊 Inspector Dom UI

**URL:** http://localhost:3000/dashboard/pipelines

**Steps:**
1. Go to Pipelines page
2. Click on your pipeline
3. Navigate through tabs:
   - **Overview**: Pipeline configuration
   - **Generated Code**: View Python, SQL, and Dagster config
   - **Deployment**: See deployment status and metadata

**What You See:**
- Deployment ID
- Pipeline name (e.g., `raw_ttb_v2`)
- Version number
- Deployment status (draft/deploying/active/failed)
- Dagster code location

---

## 2. 🗄️ Supabase Database

**Location:** Supabase Dashboard → SQL Editor

Run this query (also saved in `check-pipelines.sql`):

```sql
SELECT
  id,
  pipeline_name,
  version,
  deployment_status,
  dagster_code_location,
  deployed_at,
  LENGTH(python_code) as code_size_bytes
FROM pipeline_deployments
ORDER BY created_at DESC;
```

**To view actual Python code:**
```sql
SELECT python_code
FROM pipeline_deployments
WHERE pipeline_name = 'raw_ttb_v2';
```

---

## 3. 📁 Local Filesystem

**Location:** `dagster_home/pipelines/`

```bash
# List all deployed pipelines
ls -la dagster_home/pipelines/

# View a specific pipeline
cat dagster_home/pipelines/raw_ttb_v2.py

# Check file size
du -h dagster_home/pipelines/*.py
```

**Note:** Files are created when you click "Deploy Pipeline" in the UI.

---

## 4. 🎨 Dagster UI (Most Important for Running Pipelines!)

### Prerequisites

Install Dagster if not already installed:
```bash
pip install dagster dagster-webserver
```

### Start Dagster

```bash
./start-dagster.sh
```

Or manually:
```bash
export DAGSTER_HOME=$(pwd)/dagster_home
dagster dev -h 0.0.0.0 -p 3001
```

### Access Dagster UI

**URL:** http://localhost:3001

**What You Can Do:**
- ✅ View all deployed pipelines
- ✅ See pipeline assets and dependencies
- ✅ Run pipelines manually (click "Materialize All")
- ✅ View run history and logs
- ✅ Schedule automated runs
- ✅ Monitor asset freshness
- ✅ Debug failures

### Dagster UI Sections

1. **Assets** - View all data assets (extract_raw_ttb, transform_raw_ttb, load_raw_ttb)
2. **Runs** - See execution history
3. **Jobs** - View pipeline jobs
4. **Schedules** - Manage automated runs
5. **Sensors** - Event-driven triggers

---

## 🔄 Complete Workflow

### Step 1: Generate Code
1. Go to http://localhost:3000/dashboard/pipelines/[id]
2. Click "Generated Code" tab
3. Click "Generate Code" button
4. View the generated Python, SQL, and config

### Step 2: Deploy Pipeline
1. Go to "Deployment" tab
2. Click "Deploy Pipeline" button
3. Wait for deployment to complete
4. See deployment status change to "active"

### Step 3: View in Dagster
1. Start Dagster: `./start-dagster.sh`
2. Open http://localhost:3001
3. Click "Assets" in the left sidebar
4. Find your pipeline assets (e.g., extract_raw_ttb, load_raw_ttb)
5. Click "Materialize All" to run the pipeline

### Step 4: Monitor Execution
1. Click "Runs" in Dagster UI
2. See your pipeline execution
3. View logs and results
4. Check for any errors

---

## 🔍 Troubleshooting

### Pipeline not showing in Dagster UI?

1. **Check if file exists:**
   ```bash
   ls dagster_home/pipelines/
   ```

2. **Reload Dagster workspace:**
   - In Dagster UI: Click "Reload all" button (top right)
   - Or restart: `./start-dagster.sh`

3. **Check Python syntax:**
   ```bash
   python3 -m py_compile dagster_home/pipelines/raw_ttb_v2.py
   ```

### Deployment failed?

Check deployment status in Inspector Dom UI:
- If status is "failed", check the error message
- Common issues:
  - Python syntax errors
  - Missing dependencies (dagster, supabase-py)
  - Python3 not in PATH

### Can't access Dagster UI?

```bash
# Check if Dagster is running
lsof -i :3001

# Kill existing process
kill -9 $(lsof -t -i :3001)

# Restart
./start-dagster.sh
```

---

## 📚 Quick Reference

| What | Where | URL |
|------|-------|-----|
| Pipeline Management | Inspector Dom | http://localhost:3000/dashboard/pipelines |
| Deployment Status | Inspector Dom | http://localhost:3000/dashboard/pipelines/[id] |
| Database Records | Supabase | https://supabase.com (your project) |
| Python Files | Filesystem | `./dagster_home/pipelines/*.py` |
| Run Pipelines | Dagster UI | http://localhost:3001 |
| View Logs | Dagster UI | http://localhost:3001/runs |

---

## 🚀 Next Steps

1. **Deploy your first pipeline** in Inspector Dom UI
2. **Start Dagster** with `./start-dagster.sh`
3. **Run your pipeline** in Dagster UI (Materialize All)
4. **Check results** in Supabase database table

Your pipeline will extract data from artifacts, transform it, and load it into the target table automatically! 🎉
