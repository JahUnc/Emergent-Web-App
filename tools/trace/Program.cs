using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using EmergentSociety.Core;
using EmergentSociety.Core.Engine;
using EmergentSociety.Core.Entities;
using EmergentSociety.Core.Randomness;
using EmergentSociety.Core.Systems;
using EmergentSociety.Core.World;

namespace EmergentSociety.Explainer.Trace
{
    /// <summary>
    /// Runs small, fixed scenes through the real EmergentSociety.Core and saves what happened as JSON,
    /// so the explainer page plays back the actual code instead of a hand-written copy of the rules.
    /// </summary>
    /// <remarks>
    /// Every number this tool writes comes from calling Core: no rule is re-implemented here. Each scene
    /// either runs a whole <see cref="Simulation"/> (so the real tick order applies) or calls one system
    /// directly (so a single rule can be shown in isolation). Re-run the tool after changing Core and the
    /// explainer updates with it.
    /// </remarks>
    public static class Program
    {
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions { WriteIndented = false };

        /// <summary>
        /// Writes the recorded scenes to the output folder given as the first argument: rules.json (settings
        /// and single-rule checks), meeting.json (the two-entity scene), and one file per seed in a "seeds"
        /// folder for the world screen. Splitting them lets the site load each piece only when it is needed.
        /// </summary>
        /// <param name="args">
        /// The output folder (default "data"), then optionally how many seeds to record (default 100) and how
        /// many ticks to run each one (default 150).
        /// </param>
        public static void Main(string[] args)
        {
            string output = args.Length > 0 ? args[0] : "data";
            int seedCount = args.Length > 1 ? int.Parse(args[1]) : 100;
            int seedTicks = args.Length > 2 ? int.Parse(args[2]) : 150;
            Directory.CreateDirectory(output);

            Write(output, "rules.json", new Dictionary<string, object>
            {
                ["settings"] = BaselineSettings(),
                ["checks"] = ReproductionChecks(),
                ["kinship"] = KinshipTable(),
                ["chances"] = MeasuredChances(20000),
            });
            Write(output, "meeting.json", MeetingScene());
            SeedRecorder.WriteAll(Path.Combine(output, "seeds"), seedCount, seedTicks);
        }

        /// <summary>
        /// Serializes one value to a file in the output folder and reports it on the console.
        /// </summary>
        /// <param name="folder">The output folder.</param>
        /// <param name="name">The file name.</param>
        /// <param name="value">The value to write.</param>
        private static void Write(string folder, string name, object value)
        {
            string path = Path.Combine(folder, name);
            File.WriteAllText(path, JsonSerializer.Serialize(value, JsonOptions));
            Console.WriteLine("Wrote " + path);
        }

        /// <summary>
        /// Reads the baseline values of the settings the meeting scenes depend on, straight from <see cref="Scenario"/>.
        /// </summary>
        /// <returns>Setting name to value.</returns>
        private static Dictionary<string, object> BaselineSettings()
        {
            SimulationSettings settings = new Scenario().SimulationSettings;
            string[] names =
            {
                "MaturityAge", "ReproductionThreshold", "ReproductionCooldown", "ConceptionChance",
                "CousinConceptionFactor", "ReproductionCost", "GestationTicks", "ChildEnergy",
                "MaxEntitiesPerCell", "MaxPopulation", "RelationshipGain", "RelationshipLoss",
                "RelationshipDecay", "RelationshipFloor", "HungerThreshold", "FriendPull",
                "HungerSilencesFriends", "GestationMetabolism", "GestationMoveCost", "MetabolismPerTick", "MoveCost", "SightRange", "ForagingRange",
            };

            var values = new Dictionary<string, object>();

            foreach (string name in names)
            {
                values[name] = typeof(SimulationSettings).GetProperty(name)!.GetValue(settings)!;
            }

            return values;
        }

        /// <summary>
        /// Calls the real <see cref="ReproductionSystem.TryConceive"/> once per case, each with one condition changed
        /// from a pair that is ready to mate. Conception chance is set to 1 so the only thing that can stop a
        /// pregnancy is the rule being shown.
        /// </summary>
        /// <returns>One entry per case: its key, whether a pregnancy started, and both partners' energy afterwards.</returns>
        private static List<object> ReproductionChecks()
        {
            var cases = new List<(string Key, Action<CheckSetup> Change)>
            {
                ("ready", s => { }),
                ("young", s => s.FemaleAge = 17),
                ("justMature", s => s.FemaleAge = 18),
                ("lowEnergy", s => s.FemaleEnergy = 4.9f),
                ("recovering", s => s.FemaleLastBirth = 15),
                ("recovered", s => s.FemaleLastBirth = 10),
                ("pregnant", s => s.FemaleAlreadyPregnant = true),
                ("tooFar", s => s.MaleX = 4),
                ("sameCell", s => s.MaleX = 2),
                ("sameSex", s => s.SecondSex = Sex.Female),
                ("siblings", s => s.Siblings = true),
                ("populationFull", s => s.PopulationFull = true),
            };

            var results = new List<object>();

            foreach ((string key, Action<CheckSetup> change) in cases)
            {
                var setup = new CheckSetup();
                change(setup);
                results.Add(RunCheck(key, setup));
            }

            return results;
        }

        /// <summary>
        /// The starting state for one reproduction check: a ready female at (2,2) and a ready male beside her.
        /// </summary>
        private sealed class CheckSetup
        {
            public int FemaleAge { get; set; } = 25;
            public float FemaleEnergy { get; set; } = 8f;
            public int? FemaleLastBirth { get; set; }
            public bool FemaleAlreadyPregnant { get; set; }
            public int MaleX { get; set; } = 3;
            public Sex SecondSex { get; set; } = Sex.Male;
            public bool Siblings { get; set; }
            public bool PopulationFull { get; set; }
        }

        /// <summary>
        /// Builds a 5 by 5 world with the two partners and lets each of them try to conceive once on tick 20.
        /// </summary>
        private static object RunCheck(string key, CheckSetup setup)
        {
            const int tick = 20;
            SimulationSettings settings = new Scenario().SimulationSettings;
            settings.ConceptionChance = 1f;

            var grid = new Grid(5, 5, (x, y) => new Cell(5f, 0.05f));
            var occupancy = new OccupancyMap(5, 5);
            var lineage = new LineageRegistry();
            var traits = new EntityTraits(10f, 100, 0f, 50f);

            var female = new Entity(1, 2, 2, setup.FemaleEnergy, traits, setup.FemaleAge, Sex.Female);
            var second = new Entity(2, setup.MaleX, 2, 8f, traits, 25, setup.SecondSex);

            int? motherId = setup.Siblings ? 99 : (int?)null;

            if (setup.Siblings)
            {
                lineage.Add(new LineageRecord(99, Sex.Female, null, null, 0));
            }

            lineage.Add(new LineageRecord(1, Sex.Female, motherId, null, tick - setup.FemaleAge));
            lineage.Add(new LineageRecord(2, setup.SecondSex, motherId, null, tick - 25));

            if (setup.FemaleLastBirth.HasValue)
            {
                female.RecordBirth(setup.FemaleLastBirth.Value);
            }

            Pregnancy? earlier = null;

            if (setup.FemaleAlreadyPregnant)
            {
                earlier = new Pregnancy(50, traits, Sex.Male, tick + 2);
                female.BeginPregnancy(earlier);
            }

            occupancy.Add(female);
            occupancy.Add(second);

            var system = new ReproductionSystem(
                grid,
                occupancy,
                lineage,
                settings,
                new SplitMix64Random(settings.Seed, RandomStream.Reproduction),
                new SplitMix64Random(settings.Seed, RandomStream.Inheritance),
                new SplitMix64Random(settings.Seed, RandomStream.Sex));

            int population = setup.PopulationFull ? settings.MaxPopulation : 2;
            system.BeginTick(tick);
            system.TryConceive(female, population);
            system.TryConceive(second, population);

            bool conceived = (female.Pregnancy != null && female.Pregnancy != earlier)
                || (second.Pregnancy != null);

            return new
            {
                key,
                conceived,
                femaleEnergyAfter = Math.Round(female.Energy, 2),
                partnerEnergyAfter = Math.Round(second.Energy, 2),
                dueTick = conceived ? female.Pregnancy?.DueTick : null,
            };
        }

        /// <summary>
        /// Builds a small family in a real <see cref="LineageRegistry"/> and asks it how one entity (Ada) is related to
        /// each male relative.
        /// </summary>
        /// <returns>One row per relative with what each LineageRegistry check returned.</returns>
        private static List<object> KinshipTable()
        {
            var lineage = new LineageRegistry();
            lineage.Add(new LineageRecord(1, Sex.Female, null, null, 0));   // Grandma
            lineage.Add(new LineageRecord(2, Sex.Male, null, null, 0));     // Grandpa
            lineage.Add(new LineageRecord(3, Sex.Female, 1, 2, 20));        // Mom
            lineage.Add(new LineageRecord(4, Sex.Male, 1, 2, 22));          // Uncle (Mom's brother)
            lineage.Add(new LineageRecord(5, Sex.Male, null, null, 15));    // Dad
            lineage.Add(new LineageRecord(6, Sex.Female, null, null, 18));  // Uncle's partner
            lineage.Add(new LineageRecord(10, Sex.Male, null, null, 15));   // Mom's other partner
            lineage.Add(new LineageRecord(7, Sex.Female, 3, 5, 40));        // Ada
            lineage.Add(new LineageRecord(8, Sex.Male, 3, 5, 42));          // Brother
            lineage.Add(new LineageRecord(9, Sex.Male, 3, 10, 45));         // Half brother
            lineage.Add(new LineageRecord(11, Sex.Male, 6, 4, 41));         // Cousin
            lineage.Add(new LineageRecord(12, Sex.Male, null, null, 38));   // Stranger

            var relatives = new (int Id, string Key)[]
            {
                (5, "dad"), (2, "grandpa"), (8, "brother"), (9, "halfBrother"), (4, "uncle"), (11, "cousin"), (12, "stranger"),
            };

            var rows = new List<object>();

            foreach ((int id, string key) in relatives)
            {
                rows.Add(new
                {
                    key,
                    id,
                    closeKin = lineage.AreCloseKin(7, id),
                    cousins = lineage.AreCousins(7, id),
                    auntOrUncle = lineage.AreAuntOrUncle(7, id),
                    distantKin = lineage.AreDistantKin(7, id),
                });
            }

            return rows;
        }

        /// <summary>
        /// Measures how often the real <see cref="ReproductionSystem"/> produces a pregnancy at baseline settings,
        /// for an unrelated pair, a pair of cousins, and an uncle with his niece.
        /// </summary>
        /// <param name="trials">Number of tries per kind of pair.</param>
        /// <returns>The measured share of tries that conceived, per kind of pair.</returns>
        private static Dictionary<string, object> MeasuredChances(int trials)
        {
            var measured = new Dictionary<string, object>();

            foreach (string kind in new[] { "unrelated", "cousins", "uncleNiece" })
            {
                SimulationSettings settings = new Scenario().SimulationSettings;
                var grid = new Grid(3, 3, (x, y) => new Cell(5f, 0.05f));
                var occupancy = new OccupancyMap(3, 3);
                var lineage = new LineageRegistry();
                var system = new ReproductionSystem(
                    grid,
                    occupancy,
                    lineage,
                    settings,
                    new SplitMix64Random(settings.Seed, RandomStream.Reproduction),
                    new SplitMix64Random(settings.Seed, RandomStream.Inheritance),
                    new SplitMix64Random(settings.Seed, RandomStream.Sex));
                var traits = new EntityTraits(10f, 100, 0f, 50f);
                int nextId = 1;
                int conceived = 0;

                for (int trial = 0; trial < trials; trial++)
                {
                    (int femaleId, int maleId) = AddPairLineage(lineage, kind, ref nextId);
                    var female = new Entity(femaleId, 1, 1, 8f, traits, 25, Sex.Female);
                    var male = new Entity(maleId, 2, 1, 8f, traits, 25, Sex.Male);
                    occupancy.Add(female);
                    occupancy.Add(male);
                    system.BeginTick(trial);
                    system.TryConceive(female, 2);

                    if (female.IsPregnant)
                    {
                        conceived++;
                    }

                    occupancy.Remove(female);
                    occupancy.Remove(male);
                }

                measured[kind] = new { trials, conceived, share = Math.Round((double)conceived / trials, 4) };
            }

            return measured;
        }

        /// <summary>
        /// Adds lineage records for one pair of the given kind and returns the female's and male's ids.
        /// </summary>
        private static (int FemaleId, int MaleId) AddPairLineage(LineageRegistry lineage, string kind, ref int nextId)
        {
            int id = nextId;

            int Add(Sex sex, int? mother, int? father)
            {
                lineage.Add(new LineageRecord(id, sex, mother, father, 0));
                return id++;
            }

            if (kind == "unrelated")
            {
                (int, int) pair = (Add(Sex.Female, null, null), Add(Sex.Male, null, null));
                nextId = id;
                return pair;
            }

            int grandma = Add(Sex.Female, null, null);
            int grandpa = Add(Sex.Male, null, null);
            int mom = Add(Sex.Female, grandma, grandpa);
            int uncle = Add(Sex.Male, grandma, grandpa);
            int dad = Add(Sex.Male, null, null);
            int niece = Add(Sex.Female, mom, dad);

            if (kind == "uncleNiece")
            {
                nextId = id;
                return (niece, uncle);
            }

            int auntInLaw = Add(Sex.Female, null, null);
            int cousin = Add(Sex.Male, auntInLaw, uncle);
            nextId = id;
            return (niece, cousin);
        }

        /// <summary>
        /// Runs a whole <see cref="Simulation"/> with one female and one male on a small map and records every tick,
        /// so the page can play back meeting, bonding, conception, pregnancy, and birth in the real tick order.
        /// </summary>
        /// <remarks>
        /// The scene uses the Scenario baseline with cold, shelters, trees, and gathering turned off, so nothing but
        /// food, movement, and the social phase acts on the pair. The seed is the first one at which the pair's first
        /// try fails and a later one succeeds, which shows that conception is a roll of the dice.
        /// </remarks>
        private static object MeetingScene()
        {
            for (int seed = 1; seed < 500; seed++)
            {
                object? scene = TryMeetingSeed(seed);

                if (scene != null)
                {
                    return scene;
                }
            }

            throw new InvalidOperationException("No seed produced the meeting scene.");
        }

        /// <summary>
        /// Runs the meeting scene for one seed and returns it, or null if the seed does not show a failed first try,
        /// a conception, and a birth with both parents alive.
        /// </summary>
        private static object? TryMeetingSeed(int seed)
        {
            const int width = 7;
            const int height = 4;
            const int ticks = 18;

            SimulationSettings settings = new Scenario().SimulationSettings;
            settings.Seed = seed;
            settings.WarmthLossPerDegree = 0f;
            settings.ShelterCount = 0;
            settings.GroveCount = 0;
            settings.GatheringEnabled = false;

            var capacity = new float[,]
            {
                { 3, 4, 6, 7 }, { 4, 6, 8, 6 }, { 5, 7, 9, 5 }, { 6, 8, 7, 4 }, { 5, 6, 5, 3 }, { 4, 4, 3, 2 }, { 3, 3, 2, 2 },
            };

            var grid = new Grid(width, height, (x, y) => new Cell(capacity[x, y], 0.05f));
            var simulation = new Simulation(grid, settings);
            var traits = new EntityTraits(10f, 100, 0.2f, 60f);
            simulation.AddEntity(new Entity(1, 2, 1, 9f, traits, 22, Sex.Female));
            simulation.AddEntity(new Entity(2, 4, 2, 9f, traits, 24, Sex.Male));

            var frames = new List<object> { Frame(simulation) };
            int? conceivedAt = null;
            int? bornAt = null;
            bool missedFirstChance = false;
            int? missedAt = null;

            for (int t = 0; t < ticks; t++)
            {
                Entity mother = simulation.Entities.First(e => e.Id == 1);
                Entity father = simulation.Entities.First(e => e.Id == 2);
                bool bothReadyBefore = mother.Energy >= settings.ReproductionThreshold + 1.5f
                    && father.Energy >= settings.ReproductionThreshold + 1.5f;
                int birthsBefore = simulation.Births;

                simulation.Step();
                frames.Add(Frame(simulation));

                bool nearby = Math.Abs(mother.X - father.X) <= 1 && Math.Abs(mother.Y - father.Y) <= 1;

                if (!conceivedAt.HasValue && mother.IsPregnant)
                {
                    conceivedAt = simulation.Tick;
                }
                else if (!conceivedAt.HasValue && nearby && bothReadyBefore && !mother.IsPregnant && simulation.Tick <= 3)
                {
                    missedFirstChance = true;
                    missedAt ??= simulation.Tick;
                }

                if (!bornAt.HasValue && simulation.Births > birthsBefore)
                {
                    bornAt = simulation.Tick;
                }

                if (!mother.IsAlive || !father.IsAlive)
                {
                    return null;
                }
            }

            if (!missedFirstChance || !conceivedAt.HasValue || !bornAt.HasValue || conceivedAt.Value > 6)
            {
                return null;
            }

            var food = new List<double>();

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    food.Add(capacity[x, y]);
                }
            }

            return new { seed, width, height, capacity = food, missedAt, conceivedAt, bornAt, frames };
        }

        /// <summary>
        /// Captures every living entity, every cell's food, and the pair's relationship at the current tick.
        /// </summary>
        private static object Frame(Simulation simulation)
        {
            var cells = new List<double>();

            for (int y = 0; y < simulation.Grid.Height; y++)
            {
                for (int x = 0; x < simulation.Grid.Width; x++)
                {
                    cells.Add(Math.Round(simulation.Grid.GetCell(x, y).Food, 2));
                }
            }

            return new
            {
                tick = simulation.Tick,
                relationship = Math.Round(simulation.Relationships.Get(1, 2), 4),
                food = cells,
                entities = simulation.Entities.Where(e => e.IsAlive).Select(e => new
                {
                    id = e.Id,
                    sex = e.Sex.ToString(),
                    x = e.X,
                    y = e.Y,
                    energy = Math.Round(e.Energy, 2),
                    age = e.Age,
                    pregnant = e.IsPregnant,
                    dueTick = e.Pregnancy?.DueTick,
                    lastBirth = e.LastBirthTick,
                }).ToList(),
            };
        }
    }
}
