"""
Quick smoke test — runs without LLM, checks imports and data loading only.
Run: python test_imports.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing imports...")

from schemas.models import TaskSpec, DataAgentResult, RAGAgentResult, ComparisonAgentResult, FinalAnswer
print("  [OK] schemas.models")

from tools.data_tools import compute_csat, compute_avg_rating, extract_top_themes, filter_by_period, rating_distribution
print("  [OK] tools.data_tools")

data_path = os.path.join("data", "survey_responses.json")
if os.path.exists(data_path):
    import json
    with open(data_path) as f:
        data = json.load(f)
    responses = data["responses"]
    print(f"  [OK] survey_responses.json loaded: {len(responses):,} records")

    april = filter_by_period(responses, "2026-04-01", "2026-04-30")
    may   = filter_by_period(responses, "2026-05-01", "2026-05-31")
    print(f"  [OK] April responses: {len(april):,} | May responses: {len(may):,}")
    print(f"  [OK] April CSAT: {compute_csat(april):.1f}%  | May CSAT: {compute_csat(may):.1f}%")
    print(f"  [OK] April avg:  {compute_avg_rating(april):.3f} | May avg:  {compute_avg_rating(may):.3f}")
    print(f"  [OK] Top May themes: {[t['theme'] for t in extract_top_themes(may, 3)]}")
else:
    print(f"  [WARN] survey_responses.json not found — run: python data/generate_data.py")

index_path = os.path.join("rag", "vector_store", "faq_index.faiss")
if os.path.exists(index_path):
    from rag.retrieve import retrieve
    results = retrieve("CSAT target", top_k=2)
    print(f"  [OK] RAG retrieve: {len(results)} chunks for 'CSAT target'")
    for r in results:
        print(f"    [{r['chunk_id']}] score={r['score']:.4f}: {r['text'][:70]}...")
else:
    print(f"  [WARN] FAISS index not found — run: python rag/ingest.py")

print("\n[OK] All import checks passed!")
