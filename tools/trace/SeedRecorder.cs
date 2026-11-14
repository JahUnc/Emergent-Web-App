using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using EmergentSociety.Core;
using EmergentSociety.Core.Engine;
using EmergentSociety.Core.Entities;
using EmergentSociety.Core.Systems;
using EmergentSociety.Core.World;

namespace EmergentSociety.Explainer.Trace
{
    /// <summary>
    /// Records the first ticks of many baseline worlds, one file per seed, so visitors to the explainer
    /// can roll a new world and watch it unfold. Every frame comes from running the real
    /// <see cref="Simulation"/> built by <see cref="Scenario"/>; nothing is re-simulated in the browser.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Each seed is packed into a small binary block (stored as base64 inside JSON so any static host serves
    /// it) to keep a world near 30 KB:
    /// </para>
    /// <list type="bullet">
    /// <item><description>Food: every <c>FoodStep</c> ticks, each cell's food as 4 bits (0 to 15 of
    /// <c>foodMax</c>), two cells per byte. The site interpolates between these keyframes.</description></item>
    /// <item><description>Entities: one record per entity that was alive at any point, in order of first
    /// appearance. A record is a 6 byte header followed by one byte per later tick. That byte holds the
    /// step taken (a 3 by 3 move code, or 15 to mean "a 2 byte cell index follows") in bits 0 to 3, whether
    /// the entity is pregnant in bit 4, and whether it carries wood in bit 5.</description></item>
    /// </list>
    /// <para>
    /// Header: first frame (byte), last frame alive (byte), flags (byte: bit 0 female, bits 1 to 3 cause of
    /// death, bit 4 pregnant, bit 5 carrying wood), age at the first frame (byte, capped at 255), and the
    /// starting cell (2 bytes, little endian, y times width plus x). Causes are 0 still alive, 1 killed,
    /// 2 cold, 3 starved, 4 old age, the same order Simulation.RemoveDead uses. The recorder checks its
    /// counts against the simulation's own statistics, so the two can never disagree.
    /// </para>
    /// </remarks>
    public static class SeedRecorder
    {
        /// <summary>Ticks between food keyframes.</summary>
        public const int FoodStep = 5;

        private const int Escape = 15;

        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions { WriteIndented = false };

        /// <summary>
        /// Records seeds 1 to <paramref name="count"/> and writes seed-NNNN.json files to a folder,
        /// replacing whatever seed files were there before.
        /// </summary>
        /// <param name="folder">The output folder.</param>
        /// <param name="count">How many seeds to record.</param>
        /// <param name="ticks">How many ticks to run each seed.</param>
        /// <exception cref="ArgumentOutOfRangeException">When ticks is not between 1 and 254, since frames are stored in a byte.</exception>
        public static void WriteAll(string folder, int count, int ticks)
        {
            if (ticks < 1 || ticks > 254)
            {
                throw new ArgumentOutOfRangeException(nameof(ticks), "Ticks must be between 1 and 254.");
            }

            Directory.CreateDirectory(folder);

            foreach (string old in Directory.GetFiles(folder, "seed-*.json"))
            {
                File.Delete(old);
            }

            long bytes = 0;

            for (int seed = 1; seed <= count; seed++)
            {
                string path = Path.Combine(folder, $"seed-{seed:D4}.json");
                string json = JsonSerializer.Serialize(Record(seed, ticks), JsonOptions);
                File.WriteAllText(path, json);
                bytes += json.Length;
            }

            Console.WriteLine($"Wrote {count} seeds of {ticks} ticks to {folder} ({bytes / 1024} KB, {bytes / 1024 / count} KB per seed)");
        }

        /// <summary>
        /// Runs one seed of the baseline scenario and packs every frame.
        /// </summary>
        /// <param name="seed">The scenario seed.</param>
        /// <param name="ticks">How many ticks to run.</param>
        /// <returns>The JSON-ready record for the seed.</returns>
        public static object Record(int seed, int ticks)
        {
            var scenario = new Scenario();
            scenario.ApplySeed(seed);
            Simulation simulation = scenario.Build();
            Grid grid = simulation.Grid;
            int width = grid.Width;
            int height = grid.Height;
            int cells = width * height;

            var natural = new HashSet<int>(simulation.Shelters.Locations.Select(l => (l.Y * width) + l.X));
            var trees = new List<int[]>();

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    if (simulation.Forest.IsTree(x, y))
                    {
                        trees.Add(new[] { x, y });
                    }
                }
            }

            var food = new List<float[]>();
            var tracks = new Dictionary<int, Track>();
            var order = new List<Track>();
            var builtSince = new Dictionary<int, int>();
            var built = new List<int[]>();
            var killings = new List<int[]>();

            for (int frame = 0; frame <= ticks; frame++)
            {
                if (frame > 0)
                {
                    simulation.Step();

                    foreach (Killing k in simulation.LastTickKillings)
                    {
                        killings.Add(new[] { frame, (k.Y * width) + k.X });
                    }
                }

                if (frame % FoodStep == 0 || frame == ticks)
                {
                    var snapshot = new float[cells];

                    for (int i = 0; i < cells; i++)
                    {
                        snapshot[i] = grid.GetCell(i % width, i / width).Food;
                    }

                    food.Add(snapshot);
                }

                for (int i = 0; i < cells; i++)
                {
                    bool shelter = !natural.Contains(i) && simulation.Shelters.IsShelter(i % width, i / width);

                    if (shelter && !builtSince.ContainsKey(i))
                    {
                        builtSince[i] = frame;
                    }
                    else if (!shelter && builtSince.TryGetValue(i, out int since))
                    {
                        built.Add(new[] { i, since, frame - 1 });
                        builtSince.Remove(i);
                    }
                }

                var seen = new HashSet<int>();

                foreach (Entity entity in simulation.Entities.Where(e => e.IsAlive))
                {
                    seen.Add(entity.Id);

                    if (!tracks.TryGetValue(entity.Id, out Track? track))
                    {
                        track = new Track(entity, frame);
                        tracks[entity.Id] = track;
                        order.Add(track);
                    }

                    track.Add(entity, width);
                }

                foreach (Track track in order.Where(t => t.Cause == 0 && t.LastFrame == frame - 1 && !seen.Contains(t.Entity.Id)))
                {
                    track.Cause = CauseOf(track.Entity);
                }
            }

            foreach ((int cell, int since) in builtSince)
            {
                built.Add(new[] { cell, since, ticks });
            }

            SimulationStats stats = simulation.GetStats();
            CheckCauses(order, stats, seed);

            float foodMax = Math.Max(1f, food.Max(f => f.Max()));
            var bytes = new List<byte>();

            foreach (float[] snapshot in food)
            {
                for (int i = 0; i < cells; i += 2)
                {
                    int a = Quantize(snapshot[i], foodMax);
                    int b = i + 1 < cells ? Quantize(snapshot[i + 1], foodMax) : 0;
                    bytes.Add((byte)(a | (b << 4)));
                }
            }

            int foodBytes = bytes.Count;

            foreach (Track track in order)
            {
                track.Write(bytes, width);
            }

            return new
            {
                seed,
                width,
                height,
                ticks,
                foodStep = FoodStep,
                foodMax = Math.Round(foodMax, 3),
                foodBytes,
                entityCount = order.Count,
                trees,
                natural = natural.OrderBy(i => i).ToArray(),
                built = built.OrderBy(b => b[1]).ToList(),
                killings,
                stats = new
                {
                    alive = stats.Alive,
                    births = stats.Births,
                    starved = stats.StarvationDeaths,
                    cold = stats.ColdDeaths,
                    killed = stats.KilledDeaths,
                    oldAge = stats.OldAgeDeaths,
                    pregnanciesLost = stats.PregnanciesLost,
                    cellsBuilt = stats.CellsBuilt,
                    groups = stats.Groups,
                },
                data = Convert.ToBase64String(bytes.ToArray()),
            };
        }

        /// <summary>
        /// Classifies a death in the same order as Simulation.RemoveDead: killed, then cold, then starved,
        /// then old age.
        /// </summary>
        /// <param name="entity">An entity that has just died.</param>
        /// <returns>1 killed, 2 cold, 3 starved, 4 old age.</returns>
        private static int CauseOf(Entity entity)
        {
            if (entity.IsKilled)
            {
                return 1;
            }

            if (entity.Warmth <= 0f)
            {
                return 2;
            }

            return entity.Energy <= 0f ? 3 : 4;
        }

        /// <summary>
        /// Confirms the recorded causes of death match the simulation's own counters.
        /// </summary>
        /// <exception cref="InvalidOperationException">When any count differs.</exception>
        private static void CheckCauses(List<Track> order, SimulationStats stats, int seed)
        {
            int Count(int cause) => order.Count(t => t.Cause == cause);

            if (Count(1) != stats.KilledDeaths || Count(2) != stats.ColdDeaths
                || Count(3) != stats.StarvationDeaths || Count(4) != stats.OldAgeDeaths)
            {
                throw new InvalidOperationException($"Seed {seed}: recorded causes of death do not match SimulationStats.");
            }
        }

        /// <summary>
        /// Maps a food amount to 0 to 15.
        /// </summary>
        private static int Quantize(float value, float max) => Math.Max(0, Math.Min(15, (int)Math.Round(value / max * 15f)));

        /// <summary>
        /// One entity's life inside the recording.
        /// </summary>
        private sealed class Track
        {
            private readonly List<(int Cell, bool Pregnant, bool Wood)> _frames = new List<(int, bool, bool)>();

            public Track(Entity entity, int firstFrame)
            {
                Entity = entity;
                FirstFrame = firstFrame;
                StartAge = entity.Age;
            }

            public Entity Entity { get; }

            public int FirstFrame { get; }

            public int StartAge { get; }

            public int LastFrame => FirstFrame + _frames.Count - 1;

            public int Cause { get; set; }

            public void Add(Entity entity, int width) =>
                _frames.Add(((entity.Y * width) + entity.X, entity.IsPregnant, entity.CarriedWood > 0f));

            public void Write(List<byte> bytes, int width)
            {
                (int startCell, bool pregnant, bool wood) = _frames[0];
                int flags = (Entity.Sex == Sex.Female ? 1 : 0) | (Cause << 1) | (pregnant ? 16 : 0) | (wood ? 32 : 0);
                bytes.Add((byte)FirstFrame);
                bytes.Add((byte)LastFrame);
                bytes.Add((byte)flags);
                bytes.Add((byte)Math.Min(255, StartAge));
                bytes.Add((byte)(startCell & 0xFF));
                bytes.Add((byte)(startCell >> 8));

                for (int i = 1; i < _frames.Count; i++)
                {
                    (int cell, bool isPregnant, bool hasWood) = _frames[i];
                    int previous = _frames[i - 1].Cell;
                    int dx = (cell % width) - (previous % width);
                    int dy = (cell / width) - (previous / width);
                    int status = (isPregnant ? 16 : 0) | (hasWood ? 32 : 0);

                    if (Math.Abs(dx) <= 1 && Math.Abs(dy) <= 1)
                    {
                        bytes.Add((byte)(((dy + 1) * 3) + dx + 1 | status));
                    }
                    else
                    {
                        bytes.Add((byte)(Escape | status));
                        bytes.Add((byte)(cell & 0xFF));
                        bytes.Add((byte)(cell >> 8));
                    }
                }
            }
        }
    }
}
