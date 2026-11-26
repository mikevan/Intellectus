import json, copy
def cs(arms=(), thenable=()): return {"arms": [list(a) for a in arms], "thenable": list(thenable)}
def ex(id, steps, entry, body, inArm=(), status=(), at=(), program=(), completion=(), preds=None, language=None):
    return {"id": id, "steps": [list(s) for s in steps], "entry": list(entry), "body": body,
            "inArm": [list(x) for x in inArm], "armStatus": [list(x) for x in status],
            "awaitTarget": [list(x) for x in at], "program": [list(p) for p in program],
            "completion": [list(c) for c in completion],
            "predicates": preds if preds is not None else []}
def fx(id, language, exes, pairs=(), required=(), forbidden=(), noEvent=(), completeness=None):
    return {"id": id, "language": language, "executables": exes,
            "expect": {"pairs": [list(p) for p in pairs], "required": [list(r) for r in required],
                       "forbidden": [list(f) for f in forbidden], "noEvent": list(noEvent),
                       "completeness": completeness or {}}}
def order(before, after, *sets): return {"before": before, "after": after, "conds": list(sets)}
E = cs()
F = []
# K1..K3, K4b: two calls
def two(id, a, b, lang="typescript"):
    return fx(id, lang, [ex("f", [[a,"call"],[b,"call"],["end","exit","implicit"]], [a], [a,b],
              program=[[a,b,None],[b,"end",None]])],
              pairs=[[a,b,"T",order(f"{a}.return",f"{b}.invoke",E)]])
F.append(two("K1","s1","s2")); F.append(two("K2","f","g")); F.append(two("K3","load","use"))
F.append(fx("K4a","typescript",[ex("f",[["load","call"],["w","await"],["use","call"],["end","exit","implicit"]],["load"],["load","w","use"],
    at=[["w","load","call-result"]], program=[["load","w",None],["w","use",None],["use","end",None]], completion=[["w","load"]])],
    pairs=[["load","use","T",order("load.return","use.invoke",E)]],
    required=[["w.enter","w.continue",[E]],["w.continue","use.invoke",[E]],["w.settle","w.continue",[cs((),["w"])]],["w.settle","use.invoke",[cs((),["w"])]]],
    forbidden=[["load.return","w.settle"],["w.enter","w.settle"],["load.invoke","w.settle"]]))
k4b = two("K4b","load","use"); k4b["expect"]["delta"] = {"from":"K4a","steps":-1,"program":-1,"completion":-1,"awaitTarget":-1}; F.append(k4b)
F.append(fx("K5","typescript",[ex("f",[["b","branch"],["load","call"],["w","await"],["use","call"],["end","exit","implicit"]],["b"],
    [{"branch":"b","then":["load","w"],"else":[]},"use"],
    inArm=[["load","b","then"],["w","b","then"]], status=[["b","then","falls-through"],["b","else","falls-through"]],
    at=[["w","load","call-result"]], program=[["b","load","then"],["load","w",None],["w","use",None],["b","use","else"],["use","end",None]],
    completion=[["w","load"]], preds=[["b","pred:b"]])],
    pairs=[["load","use","T",order("load.return","use.invoke",cs([("b","then")]))]],
    required=[["w.settle","use.invoke",[cs([("b","then")],["w"])]]],
    forbidden=[["w.enter","w.settle"],["load.return","w.settle"]]))
F.append(fx("K6a","typescript",[ex("f",[["B","branch"],["a","call"],["b","call"],["end","exit","implicit"]],["B"],
    [{"branch":"B","then":["a"],"else":["b"]}], inArm=[["a","B","then"],["b","B","else"]],
    status=[["B","then","falls-through"],["B","else","falls-through"]],
    program=[["B","a","then"],["B","b","else"],["a","end",None],["b","end",None]], preds=[["B","pred:c"]])],
    pairs=[["a","b","X",None]], required=[["a.return","end.exit",[cs([("B","then")])]],["b.return","end.exit",[cs([("B","else")])]]]))
def twobranch(id, p1, p2):
    return fx(id,"typescript",[ex("f",[["B1","branch"],["a","call"],["B2","branch"],["b","call"],["end","exit","implicit"]],["B1"],
        [{"branch":"B1","then":["a"],"else":[]},{"branch":"B2","then":["b"],"else":[]}],
        inArm=[["a","B1","then"],["b","B2","then"]],
        status=[["B1","then","falls-through"],["B1","else","falls-through"],["B2","then","falls-through"],["B2","else","falls-through"]],
        program=[["B1","a","then"],["B1","B2","else"],["a","B2",None],["B2","b","then"],["B2","end","else"],["b","end",None]],
        preds=[["B1",p1],["B2",p2]])],
        pairs=[["a","b","U",order("a.return","b.invoke",cs([("B1","then"),("B2","then")]))]])
F.append(twobranch("K6b","pred:c","pred:c")); F.append(twobranch("K6c","pred:x>0","pred:x<0"))
k6d_steps=[["B","branch"],["a","call"],["r","exit"],["b","call"],["end","exit","implicit"]]
k6d_body=[{"branch":"B","then":["a","r"],"else":[]},"b"]
F.append(fx("K6d","typescript",[ex("f",k6d_steps,["B"],k6d_body,inArm=[["a","B","then"],["r","B","then"]],
    status=[["B","then","always-exits"],["B","else","falls-through"]],
    program=[["B","a","then"],["a","r",None],["B","b","else"],["b","end",None]], preds=[["B","pred:c"]])],
    pairs=[["a","b","X",None]]))
F.append(fx("K6d-i","typescript",[ex("f",k6d_steps,["B"],k6d_body,inArm=[["a","B","then"],["r","B","then"]],
    status=[["B","then","always-exits"],["B","else","falls-through"]], program=[], preds=[["B","pred:c"]])],
    pairs=[["a","b","U",None]], completeness={"f":["edges","reachability"]}))
F.append(fx("K6e","typescript",[ex("f",[["B","branch"],["a","call"],["o","opaque"],["b","call"],["end","exit","implicit"]],["B"],
    [{"branch":"B","then":["a","o"],"else":[]},"b"], inArm=[["a","B","then"],["o","B","then"]],
    status=[["B","then","unknown"],["B","else","falls-through"]],
    program=[["B","a","then"],["a","o",None],["o","b",None],["B","b","else"],["b","end",None]], preds=[["B","pred:c"]])],
    pairs=[["a","o","T",order("a.return","o.start",cs([("B","then")]))],["a","b","U",order("a.return","b.invoke",cs([("B","then")]))],
           ["o","b","U",order("o.end","b.invoke",cs([("B","then")]))]]))
F.append(fx("K7","typescript",[ex("loadLanguage",
    [["b1","branch"],["c1","call"],["w1","await"],["c2","call"],["b2","branch"],["c3","call"],["w2","await"],["c4","call"],["x1","exit"]],["b1"],
    [{"branch":"b1","then":["c1"],"else":[]},"w1","c2",{"branch":"b2","then":["c3","w2","c4"],"else":[]},"x1"],
    inArm=[["c1","b1","then"],["c3","b2","then"],["w2","b2","then"],["c4","b2","then"]],
    status=[["b1","then","falls-through"],["b1","else","falls-through"],["b2","then","falls-through"],["b2","else","falls-through"]],
    at=[["w1",None,"unresolved"],["w2","c3","call-result"]],
    program=[["b1","c1","then"],["c1","w1",None],["b1","w1","else"],["w1","c2",None],["c2","b2",None],["b2","c3","then"],["c3","w2",None],["w2","c4",None],["c4","x1",None],["b2","x1","else"]],
    completion=[["w2","c3"]], preds=[["b1","pred:!ready"],["b2","pred:!lang"]])],
    pairs=[["c1","c2","T",order("c1.return","c2.invoke",cs([("b1","then")]))],
           ["c1","c3","U",order("c1.return","c3.invoke",cs([("b1","then"),("b2","then")]))],
           ["c1","c4","U",order("c1.return","c4.invoke",cs([("b1","then"),("b2","then")]))],
           ["c2","c3","T",order("c2.return","c3.invoke",cs([("b2","then")]))],
           ["c2","c4","T",order("c2.return","c4.invoke",cs([("b2","then")]))],
           ["c3","c4","T",order("c3.return","c4.invoke",cs([("b2","then")]))]],
    required=[["w1.enter","w1.continue",[E]],["w1.continue","c2.invoke",[E]],["w1.settle","w1.continue",[cs((),["w1"])]],
              ["w2.settle","c4.invoke",[cs([("b2","then")],["w2"])]]],
    forbidden=[["c3.return","w2.settle"],["w2.enter","w2.settle"],["c1.return","w1.settle"],["c1.invoke","w1.settle"],["c1.return","w2.settle"]]))
F.append(fx("K8","typescript",[ex("f",[["B1","branch"],["B2","branch"],["a","call"],["b","call"],["z","call"],["end","exit","implicit"]],["B1"],
    [{"branch":"B1","then":[{"branch":"B2","then":["a"],"else":[]},"b"],"else":[]},"z"],
    inArm=[["B2","B1","then"],["b","B1","then"],["a","B2","then"]],
    status=[["B1","then","falls-through"],["B1","else","falls-through"],["B2","then","falls-through"],["B2","else","falls-through"]],
    program=[["B1","B2","then"],["B2","a","then"],["a","b",None],["B2","b","else"],["b","z",None],["B1","z","else"],["z","end",None]],
    preds=[["B1","pred:c"],["B2","pred:d"]])],
    pairs=[["a","b","T",order("a.return","b.invoke",cs([("B1","then"),("B2","then")]))],
           ["a","z","T",order("a.return","z.invoke",cs([("B1","then"),("B2","then")]))],
           ["b","z","T",order("b.return","z.invoke",cs([("B1","then")]))]]))
F.append(fx("K9","typescript",[ex("f",[["B","branch"],["a","call"],["b","call"],["d","call"],["end","exit","implicit"]],["B"],
    [{"branch":"B","then":["a"],"else":["b"]},"d"], inArm=[["a","B","then"],["b","B","else"]],
    status=[["B","then","falls-through"],["B","else","falls-through"]],
    program=[["B","a","then"],["B","b","else"],["a","d",None],["b","d",None],["d","end",None]], preds=[["B","pred:c"]])],
    pairs=[["a","b","X",None],["a","d","T",order("a.return","d.invoke",cs([("B","then")]))],["b","d","T",order("b.return","d.invoke",cs([("B","else")]))]]))
F.append(twobranch("K10","pred:p","pred:q"))
def await_one(id, cls, lit, lang="typescript"):
    return ex("f",[["w","await"],["use","call"],["end","exit","implicit"]],["w"],["w","use"],
              at=[["w",None,cls,lit]], program=[["w","use",None],["use","end",None]])
F.append(fx("K11","typescript",[await_one("K11","unresolved","ready")],
    required=[["w.enter","w.continue",[E]],["w.continue","use.invoke",[E]],["w.settle","w.continue",[cs((),["w"])]]],
    forbidden=[["w.enter","w.settle"]]))
F.append(fx("K12","typescript",[ex("f",[["f","call"],["g","call"],["end","exit","implicit"]],["f"],["f","g"],program=[])],
    pairs=[["f","g","T",None]], completeness={"f":["edges","reachability"]}))
F.append(fx("K13","typescript",[ex("f",[["load","call"],["work","call"],["w","await"],["use","call"],["end","exit","implicit"]],["load"],["load","work","w","use"],
    at=[["w","load","call-result"]], program=[["load","work",None],["work","w",None],["w","use",None],["use","end",None]], completion=[["w","load"]])],
    pairs=[["load","work","T",order("load.return","work.invoke",E)],["load","use","T",order("load.return","use.invoke",E)],["work","use","T",order("work.return","use.invoke",E)]],
    required=[["w.settle","w.continue",[cs((),["w"])]],["w.continue","use.invoke",[E]]],
    forbidden=[["w.settle","work.invoke"],["w.enter","w.settle"],["load.return","w.settle"]]))
F.append(fx("K14","typescript",[ex("cached",[["x","exit"]],["x"],["x"]),
    ex("g",[["c","call"],["w","await"],["use","call"],["end","exit","implicit"]],["c"],["c","w","use"],
       at=[["w","c","call-result"]], program=[["c","w",None],["w","use",None],["use","end",None]], completion=[["w","c"]])],
    pairs=[["c","use","T",order("c.return","use.invoke",E)]],
    required=[["w.settle","use.invoke",[cs((),["w"])]]],
    forbidden=[["c.invoke","w.settle"],["c.return","w.settle"],["w.enter","w.settle"]]))
F.append(fx("K15","typescript",[await_one("K15","unresolved","ready")],
    required=[["w.enter","w.continue",[E]],["w.continue","use.invoke",[E]],["w.settle","w.continue",[cs((),["w"])]]],
    forbidden=[["w.enter","w.settle"]]))
F.append(fx("K16","typescript",[await_one("K16","plain-value","42")],
    required=[["w.enter","w.continue",[E]],["w.continue","use.invoke",[E]]], noEvent=["w.settle"]))
F.append(fx("K16-py","python",[await_one("K16-py","plain-value","42")],
    required=[["w.enter","w.continue",[E]],["w.continue","use.invoke",[E]],["w.settle","w.continue",[E]]]))
F.append(fx("K17","typescript",[ex("f",[["B","branch"],["o","opaque"],["a","call"],["b","call"],["end","exit","implicit"]],["B"],
    [{"branch":"B","then":["o","a"],"else":[]},"b"], inArm=[["o","B","then"],["a","B","then"]],
    status=[["B","then","unknown"],["B","else","falls-through"]],
    program=[["B","o","then"],["o","a",None],["a","b",None],["B","b","else"],["b","end",None]], preds=[["B","pred:c"]])],
    pairs=[["o","a","T",order("o.end","a.invoke",cs([("B","then")]))],["o","b","U",order("o.end","b.invoke",cs([("B","then")]))],
           ["a","b","U",order("a.return","b.invoke",cs([("B","then")]))]]))
F.append(fx("K18","typescript",[ex("f",[["B1","branch"],["a","call"],["B2","branch"],["o","opaque"],["r","exit"],["b","call"],["end","exit","implicit"]],["B1"],
    [{"branch":"B1","then":["a",{"branch":"B2","then":["o"],"else":["r"]}],"else":[]},"b"],
    inArm=[["a","B1","then"],["B2","B1","then"],["o","B2","then"],["r","B2","else"]],
    status=[["B2","then","unknown"],["B2","else","always-exits"],["B1","then","unknown"],["B1","else","falls-through"]],
    program=[["B1","a","then"],["a","B2",None],["B2","o","then"],["B2","r","else"],["o","b",None],["B1","b","else"],["b","end",None]],
    preds=[["B1","pred:c"],["B2","pred:d"]])],
    pairs=[["a","o","T",order("a.return","o.start",cs([("B1","then"),("B2","then")]))],
           ["a","b","U",order("a.return","b.invoke",cs([("B1","then"),("B2","then")]))],
           ["o","b","U",order("o.end","b.invoke",cs([("B1","then"),("B2","then")]))]]))
F.append(fx("K19","typescript",[ex("f",[["B1","branch"],["a","call"],["B2","branch"],["x","call"],["r","exit"],["b","call"],["end","exit","implicit"]],["B1"],
    [{"branch":"B1","then":["a",{"branch":"B2","then":["x"],"else":["r"]}],"else":[]},"b"],
    inArm=[["a","B1","then"],["B2","B1","then"],["x","B2","then"],["r","B2","else"]],
    status=[["B2","then","falls-through"],["B2","else","always-exits"],["B1","then","falls-through"],["B1","else","falls-through"]],
    program=[["B1","a","then"],["a","B2",None],["B2","x","then"],["B2","r","else"],["x","b",None],["B1","b","else"],["b","end",None]],
    preds=[["B1","pred:c"],["B2","pred:d"]])],
    pairs=[["a","x","T",order("a.return","x.invoke",cs([("B1","then"),("B2","then")]))],
           ["a","b","T",order("a.return","b.invoke",cs([("B1","then"),("B2","then")]))],
           ["x","b","T",order("x.return","b.invoke",cs([("B1","then"),("B2","then")]))]]))
F.append(fx("K21","typescript",[ex("f",[["B","branch"],["o","opaque"],["r","exit"],["b","call"],["end","exit","implicit"]],["B"],
    [{"branch":"B","then":["o","r"],"else":[]},"b"], inArm=[["o","B","then"],["r","B","then"]],
    status=[["B","then","always-exits"],["B","else","falls-through"]],
    program=[["B","o","then"],["o","r",None],["B","b","else"],["b","end",None]], preds=[["B","pred:c"]])],
    pairs=[["o","b","X",None]]))
F.append(fx("K22","typescript",[ex("f",[["f","call"],["g","call"],["h","call"],["end","exit","implicit"]],["f"],["f","g"],
    program=[["f","g",None],["g","end",None],["h","end",None]])],
    pairs=[["f","g","T",order("f.return","g.invoke",E)],["f","h","T",None],["g","h","T",None]],
    required=[["h.return","end.exit",[E]]], completeness={"f":["reachability"]}))
# Legacy L1
L1 = fx("L1","typescript",[ex("e1",[["s","call"],["end","exit","implicit"]],["s"],["s"],program=[["s","end",None]]),
                           ex("e2",[["t","call"],["end","exit","implicit"]],["t"],["t"],program=[["t","end",None]])])
L1["legacy"] = {"followsExecutable": [["e2","e1","thread","T1"]], "hasPredicateExecutable": [["e1","pred:p1"],["e1","pred:p2"]]}
L1["expect"]["refusals"] = []
F.append(L1)
# K9b engine
engine = {"id":"K9b","facts":[{"before":"x","after":"m","conds":cs([("B","then")])},{"before":"m","after":"y","conds":cs([("B","else")])}],
          "forbidden":[["x","y"]], "conditionBlindMustDerive":[["x","y"]]}
# mini fixtures for cross-executable refusals
X13 = fx("X13","typescript",[ex("p",[["f","call"],["end","exit","implicit"]],["f"],["f"],program=[["f","end",None]]),
    ex("q",[["w","await"],["use","call"],["end","exit","implicit"]],["w"],["w","use"],at=[["w","p:f","call-result"]],program=[["w","use",None],["use","end",None]])])
X14 = fx("X14","typescript",[ex("p",[["B","branch"],["a","call"],["end","exit","implicit"]],["B"],[{"branch":"B","then":["a"],"else":[]}],
    inArm=[["a","B","then"]],status=[["B","then","falls-through"],["B","else","falls-through"]],
    program=[["B","a","then"],["B","end","else"],["a","end",None]],preds=[["B","pred:c"]]),
    ex("q",[["s","call"],["end","exit","implicit"]],["s"],["s"],inArm=[["s","p:B","then"]],program=[["s","end",None]])])
# refusal controls: base fixture + mutations
R = []
def r(rule, alt, base, cands=("A","B"), **m): R.append({"rule":rule,"alt":alt,"base":base,"candidates":list(cands),"mutate":m,"expect":[rule]})
r("R1","program from an executable","K1",addProgram=[["@f","s2",None]], removeProgram=[])
r("R1","program to an executable","K1",removeProgram=[["s2","end",None]],addProgram=[["s2","@f",None]])
r("R2","program across executables","K14",exe="g",removeProgram=[["c","w",None]],addProgram=[["c","cached:x",None]])
r("R2","A: within names another executable","K1",cands=("A",),setWithin=[["s1","s2","cached"]])
r("R3","program self-loop","K1",removeProgram=[["s1","s2",None]],addProgram=[["s1","s1",None]])
r("R4","program leaves an explicit exit","K6d",addProgram=[["r","b",None]])
r("R4","program leaves the implicit exit","K1",addProgram=[["end","s1",None]])
r("R5","branch fact without an arm","K6a",removeProgram=[["B","a","then"]],addProgram=[["B","a",None]])
r("R6","arm on a non-branch","K1",removeProgram=[["s1","s2",None]],addProgram=[["s1","s2","then"]])
r("R7","second fact from a non-branch","K1",addProgram=[["s1","end",None]])
r("R7","second fact on one branch arm","K6a",addProgram=[["B","b","then"]])
r("R8","completion between two calls","K4a",removeCompletion=[["w","load"]],addCompletion=[["use","load"]])
r("R8","completion between two awaits","K7",addCompletion=[["w1","w2"]])
r("R8","completion from an await to a branch","K7",removeCompletion=[["w2","c3"]],addCompletion=[["w2","b2"]])
r("R9","completion call differs from AWAIT_TARGET","K13",removeCompletion=[["w","load"]],addCompletion=[["w","work"]])
r("R10","completion with operandClass unresolved","K11",addCompletion=[["w","use"]])
r("R10","completion with operandClass plain-value","K16",addCompletion=[["w","use"]])
r("R11","second completion for one await","K4a",addCompletion=[["w","load"]])
r("R12","await without AWAIT_TARGET","K4a",removeAwaitTarget=["w"],removeCompletion=[["w","load"]])
r("R12","await with two AWAIT_TARGET","K4a",addAwaitTarget=[["w","use","call-result"]])
r("R13","AWAIT_TARGET to a non-call step","K4a",removeAwaitTarget=["w"],removeCompletion=[["w","load"]],addAwaitTarget=[["w","end","call-result"]])
r("R13","AWAIT_TARGET to another executable's call","X13")
r("R13","call step with class unresolved","K4a",removeAwaitTarget=["w"],removeCompletion=[["w","load"]],addAwaitTarget=[["w","load","unresolved"]])
r("R13","literal with class call-result","K11",removeAwaitTarget=["w"],addAwaitTarget=[["w",None,"call-result","ready"]])
r("R14","IN_ARM to a non-branch","K5",removeInArm=[["load","b","then"]],addInArm=[["load","use","then"]])
r("R14","IN_ARM across executables","X14")
r("R15","a step with two IN_ARM","K5",addInArm=[["load","b","else"]])
r("R16","IN_ARM cycle","K8",addInArm=[["B1","B2","then"]])
r("R17","ARM_STATUS on a non-branch","K1",addStatus=[["s1","then","falls-through"]])
r("R17","duplicate ARM_STATUS for one arm","K6a",addStatus=[["B","then","falls-through"]])
r("R18","entry missing","K1",setEntry=[])
r("R18","entry duplicated","K1",setEntry=["s1","s2"])
r("R18","entry owned by another executable","K14",exe="g",setEntry=["cached:x"])
r("R18","entry with an incoming program fact","K1",setEntry=["s2"])
r("R19","event-graph cycle","K1",removeProgram=[["s2","end",None]],addProgram=[["s2","s1",None]])
r("R20","predicate on a non-branch","K6a",addPredicate=[["a","pred:x"]])
r("R21","second predicate for one branch","K6a",addPredicate=[["B","pred:y"]])
r("R23","implicit on a non-exit","K1",setImplicit=["s1"])
M = {"version":"r1b1-manifest-1","fixtures":F,"mini":[X13,X14],"engine":[engine],"refusals":R,
     "deferred":[{"rule":"R22","why":"the validator may not read predicate text; moved to ingestion and encoder verification (amendment A4)"}],
     "ablation":["K4a","K5","K7","K13","K14"],"combinations":[["A","H1"],["A","H2"],["B","H1"],["B","H2"]]}
open("manifest.json","w").write(json.dumps(M, indent=1, sort_keys=True) + "\n")
print(len(F), "fixtures,", len(R), "refusal controls")
