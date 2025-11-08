use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use agentdb_wasm::{AgentDb, Agent, AgentRole, Franchise, QueryFilter};

fn bench_agent_creation(c: &mut Criterion) {
    c.bench_function("agent_creation", |b| {
        let mut db = AgentDb::new();
        let mut counter = 0;
        b.iter(|| {
            let agent = Agent::new(format!("Agent {}", counter), AgentRole::Worker);
            counter += 1;
            black_box(db.upsert_agent(agent).unwrap());
        });
    });
}

fn bench_agent_query(c: &mut Criterion) {
    let mut group = c.benchmark_group("agent_query");

    for size in [10, 100, 1000].iter() {
        let mut db = AgentDb::new();

        // Pre-populate database
        for i in 0..*size {
            let agent = Agent::new(format!("Agent {}", i), AgentRole::Worker);
            db.upsert_agent(agent).unwrap();
        }

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            let filter = QueryFilter {
                limit: Some(10),
                ..Default::default()
            };
            b.iter(|| {
                black_box(db.query_agents(&filter));
            });
        });
    }

    group.finish();
}

fn bench_franchise_creation(c: &mut Criterion) {
    c.bench_function("franchise_creation", |b| {
        let mut db = AgentDb::new();
        let mut counter = 0;
        b.iter(|| {
            let franchise = Franchise::new(
                format!("Franchise {}", counter),
                format!("owner-{}", counter),
                "Location".to_string(),
            );
            counter += 1;
            black_box(db.upsert_franchise(franchise).unwrap());
        });
    });
}

fn bench_agent_assignment(c: &mut Criterion) {
    c.bench_function("agent_assignment", |b| {
        let mut db = AgentDb::new();

        // Create agents and franchises
        let mut agents = Vec::new();
        let mut franchises = Vec::new();

        for i in 0..100 {
            let agent = Agent::new(format!("Agent {}", i), AgentRole::Worker);
            agents.push(db.upsert_agent(agent).unwrap().id);

            let franchise = Franchise::new(
                format!("Franchise {}", i),
                format!("owner-{}", i),
                "Location".to_string(),
            );
            franchises.push(db.upsert_franchise(franchise).unwrap().id);
        }

        let mut counter = 0;
        b.iter(|| {
            let agent_id = &agents[counter % agents.len()];
            let franchise_id = &franchises[counter % franchises.len()];
            counter += 1;
            black_box(db.assign_agent_to_franchise(agent_id, franchise_id).unwrap());
        });
    });
}

fn bench_export_import(c: &mut Criterion) {
    let mut group = c.benchmark_group("export_import");

    for size in [10, 100, 1000].iter() {
        let mut db = AgentDb::new();

        // Pre-populate database
        for i in 0..*size {
            let agent = Agent::new(format!("Agent {}", i), AgentRole::Worker);
            db.upsert_agent(agent).unwrap();
        }

        let exported = db.export().unwrap();

        group.bench_with_input(BenchmarkId::new("export", size), size, |b, _| {
            b.iter(|| {
                black_box(db.export().unwrap());
            });
        });

        group.bench_with_input(BenchmarkId::new("import", size), size, |b, _| {
            let mut new_db = AgentDb::new();
            b.iter(|| {
                black_box(new_db.import(&exported).unwrap());
            });
        });
    }

    group.finish();
}

fn bench_event_retrieval(c: &mut Criterion) {
    let mut group = c.benchmark_group("event_retrieval");

    for size in [10, 100, 1000].iter() {
        let mut db = AgentDb::new();

        // Create events by doing operations
        for i in 0..*size {
            let agent = Agent::new(format!("Agent {}", i), AgentRole::Worker);
            db.upsert_agent(agent).unwrap();
        }

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            b.iter(|| {
                black_box(db.get_events(None, Some(10)));
            });
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_agent_creation,
    bench_agent_query,
    bench_franchise_creation,
    bench_agent_assignment,
    bench_export_import,
    bench_event_retrieval
);
criterion_main!(benches);
