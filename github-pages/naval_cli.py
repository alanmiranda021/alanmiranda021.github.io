"""Execução local do protocolo naval: python naval_cli.py dados.mat --mode completo."""
import argparse
import hashlib
from pathlib import Path
from core.io import load_table
from core.exp_artigo3 import NavalConfig, run_naval
from core.report_pdf import naval_pdf


def main():
    parser = argparse.ArgumentParser(description="Protocolo do Artigo 3 adaptado — laboratório naval exploratório")
    parser.add_argument("input", type=Path)
    parser.add_argument("--mode", choices=["rapido", "mvp", "completo"], default="completo")
    parser.add_argument("--pre-trip", action="store_true", help="Excluir eficiência indisponível antes da viagem")
    parser.add_argument("--diagnostic", action="store_true", help="Incluir E3-orig somente no completo local")
    parser.add_argument("--sensitivity", action="store_true")
    parser.add_argument("--budget-seconds", type=float, default=7200.)
    parser.add_argument("--draws", type=int, default=0)
    parser.add_argument("--maxiter", type=int, default=0)
    parser.add_argument("--hidden", type=int, nargs='+', default=[3,4,5,6])
    parser.add_argument("--folds", type=int, default=0)
    parser.add_argument("--inner-folds", type=int, default=0)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--output", type=Path, default=Path("protocolo_artigo3_naval.pdf"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--target", choices=["fuel_consumption", "CO2_emissions"], default="fuel_consumption")
    args = parser.parse_args()
    raw = args.input.read_bytes()
    table = load_table(args.input.name, raw)
    from core.exp_artigo3 import SCENARIOS
    cfg = NavalConfig(mode=args.mode, seed=args.seed, target=args.target, use_efficiency=not args.pre_trip,
        scenarios=tuple(SCENARIOS) if args.diagnostic else (), sensitivity=args.sensitivity, budget_seconds=args.budget_seconds,
        draws=args.draws, maxiter=args.maxiter, hidden_grid=tuple(args.hidden),
        outer_folds=args.folds, inner_folds=args.inner_folds, repeats=args.repeats,
        excluded=("CO2_emissions" if args.target == "fuel_consumption" else "fuel_consumption",),
        filename=args.input.name, source_sha256=hashlib.sha256(raw).hexdigest())
    result = run_naval(table, cfg, progress=lambda p, text: print(f"{p:.0%} {text}", flush=True))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(naval_pdf(result))
    print(f"PDF: {args.output.resolve()} | duração: {result['seconds']:.1f}s | falhas: {len(result['failures'])}")
    return 0 if result["test"] is not None else 1


if __name__ == "__main__":
    raise SystemExit(main())
