/* Copyright (C) 2021 Wildfire Games.
 * This file is part of 0 A.D.
 *
 * 0 A.D. is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * 0 A.D. is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with 0 A.D.  If not, see <http://www.gnu.org/licenses/>.
 */

#include "lib/self_test.h"

#include "graphics/Camera.h"
#include "maths/MathUtil.h"
#include "maths/Vector3D.h"

#include <cmath>
#include <vector>

class TestCamera : public CxxTest::TestSuite
{
public:
	void test_frustum_perspective()
	{
		SViewPort viewPort;
		viewPort.m_X = 0;
		viewPort.m_Y = 0;
		viewPort.m_Width = 512;
		viewPort.m_Height = 512;

		CCamera camera;
		camera.SetViewPort(viewPort);
		camera.LookAlong(
			CVector3D(0.0f, 0.0f, 0.0f),
			CVector3D(0.0f, 0.0f, 1.0f),
			CVector3D(0.0f, 1.0f, 0.0f)
		);
		camera.SetPerspectiveProjection(1.0f, 101.0f, DEGTORAD(90.0f));
		TS_ASSERT_EQUALS(camera.GetProjectionType(), CCamera::ProjectionType::PERSPECTIVE);
		camera.UpdateFrustum();

		const float sqrt2 = sqrtf(2.0f) / 2.0f;
		const std::vector<CPlane> expectedPlanes = {
			CVector4D(sqrt2, 0.0f, sqrt2, 0.0f),
			CVector4D(-sqrt2, 0.0f, sqrt2, 0.0f),
			CVector4D(0.0f, sqrt2, sqrt2, 0.0f),
			CVector4D(0.0f, -sqrt2, sqrt2, 0.0f),
			CVector4D(0.0f, 0.0f, -1.0f, 101.0f),
			CVector4D(0.0f, 0.0f, 1.0f, -1.0f),
		};
		CheckFrustumPlanes(camera.GetFrustum(), expectedPlanes);
	}

	void test_frustum_ortho()
	{
		SViewPort viewPort;
		viewPort.m_X = 0;
		viewPort.m_Y = 0;
		viewPort.m_Width = 512;
		viewPort.m_Height = 512;

		CCamera camera;
		camera.SetViewPort(viewPort);
		camera.LookAlong(
			CVector3D(0.0f, 0.0f, 0.0f),
			CVector3D(0.0f, 0.0f, 1.0f),
			CVector3D(0.0f, 1.0f, 0.0f)
		);
		CMatrix3D projection;
		projection.SetOrtho(-10.0f, 10.0f, -10.0f, 10.0f, -10.0f, 10.0f);
		camera.SetProjection(projection);
		TS_ASSERT_EQUALS(camera.GetProjectionType(), CCamera::ProjectionType::CUSTOM);
		camera.UpdateFrustum();

		const std::vector<CPlane> expectedPlanes = {
			CVector4D(1.0f, 0.0f, 0.0f, 10.0f),
			CVector4D(-1.0f, 0.0f, 0.0f, 10.0f),
			CVector4D(0.0f, 1.0f, 0.0f, 10.0f),
			CVector4D(0.0f, -1.0f, 0.0f, 10.0f),
			CVector4D(0.0f, 0.0f, 1.0f, 10.0f),
			CVector4D(0.0f, 0.0f, -1.0f, 10.0f)
		};
		CheckFrustumPlanes(camera.GetFrustum(), expectedPlanes);
	}

	// Order of planes is unknown. So use interactive checker.
	void CheckFrustumPlanes(const CFrustum& frustum, const std::vector<CPlane>& expectedPlanes)
	{
		TS_ASSERT_EQUALS(frustum.GetNumPlanes(), expectedPlanes.size());
		std::set<size_t> indices;
		for (size_t i = 0; i < expectedPlanes.size(); ++i)
			indices.insert(i);

		for (size_t i = 0; i < frustum.GetNumPlanes(); ++i)
		{
			bool found = false;
			for (size_t j : indices)
			{
				if (EqualPlanes(frustum[i], expectedPlanes[j]))
				{
					found = true;
					indices.erase(j);
					break;
				}
			}
			if (!found)
				TS_FAIL(frustum[i]);
		}
	}

	bool EqualPlanes(const CPlane& p1, const CPlane& p2) const
	{
		const float EPS = 1e-3f;
		if (std::fabs(p1.m_Dist - p2.m_Dist) >= EPS)
			return false;
		return
			std::fabs(p1.m_Norm.X - p2.m_Norm.X) < EPS &&
			std::fabs(p1.m_Norm.Y - p2.m_Norm.Y) < EPS &&
			std::fabs(p1.m_Norm.Z - p2.m_Norm.Z) < EPS;
	}

	void CompareQuads(const CCamera::Quad& quad, const CCamera::Quad& expectedQuad)
	{
		const float EPS = 1e-4f;
		for (size_t index = 0; index < expectedQuad.size(); ++index)
		{
			TS_ASSERT_DELTA(quad[index].X, expectedQuad[index].X, EPS);
			TS_ASSERT_DELTA(quad[index].Y, expectedQuad[index].Y, EPS);
			TS_ASSERT_DELTA(quad[index].Z, expectedQuad[index].Z, EPS);
		}
	}

	void CompareQuadsInWorldSpace(const CCamera& camera, const CCamera::Quad& quad, const CCamera::Quad& expectedQuad)
	{
		const float EPS = 1e-4f;
		for (size_t index = 0; index < expectedQuad.size(); ++index)
		{
			// Transform quad points from camera space to world space.
			CVector3D point = camera.GetOrientation().Transform(quad[index]);

			TS_ASSERT_DELTA(point.X, expectedQuad[index].X, EPS);
			TS_ASSERT_DELTA(point.Y, expectedQuad[index].Y, EPS);
			TS_ASSERT_DELTA(point.Z, expectedQuad[index].Z, EPS);
		}
	}

	void test_perspective_plane_points()
	{
		SViewPort viewPort;
		viewPort.m_X = 0;
		viewPort.m_Y = 0;
		viewPort.m_Width = 512;
		viewPort.m_Height = 512;

		CCamera camera;
		camera.SetViewPort(viewPort);
		camera.LookAt(
			CVector3D(10.0f, 20.0f, 10.0f),
			CVector3D(10.0f, 10.0f, 20.0f),
			CVector3D(0.0f, 1.0f, 1.0f).Normalized()
		);
		camera.SetPerspectiveProjection(1.0f, 101.0f, DEGTORAD(90.0f));

		CCamera::Quad quad;

		// Zero distance point is the origin of all camera rays,
		// so all plane points should stay there.
		camera.GetViewQuad(0.0f, quad);
		for (const CVector3D& point : quad)
			TS_ASSERT_EQUALS(point, CVector3D(0.0f, 0.0f, 0.0f));

		// Points lying on the near plane.
		CCamera::Quad expectedNearQuad = {
			CVector3D(-1.0f, -1.0f, 1.0f),
			CVector3D(1.0f, -1.0f, 1.0f),
			CVector3D(1.0f, 1.0f, 1.0f),
			CVector3D(-1.0f, 1.0f, 1.0f)
		};
		CCamera::Quad nearQuad;
		camera.GetViewQuad(camera.GetNearPlane(), nearQuad);
		CompareQuads(nearQuad, expectedNearQuad);

		CCamera::Quad expectedWorldSpaceNearQuad = {
			CVector3D(9.0f, 18.5857868f, 10.0f),
			CVector3D(11.0f, 18.5857868f, 10.0f),
			CVector3D(11.0f, 20.0f, 11.4142132f),
			CVector3D(9.0f, 20.0f, 11.4142132f)
		};
		CompareQuadsInWorldSpace(camera, nearQuad, expectedWorldSpaceNearQuad);

		// Points lying on the far plane.
		CCamera::Quad expectedFarQuad = {
			CVector3D(-101.0f, -101.0f, 101.0f),
			CVector3D(101.0f, -101.0f, 101.0f),
			CVector3D(101.0f, 101.0f, 101.0f),
			CVector3D(-101.0f, 101.0f, 101.0f)
		};
		CCamera::Quad farQuad;
		camera.GetViewQuad(camera.GetFarPlane(), farQuad);
		CompareQuads(farQuad, expectedFarQuad);

		CCamera::Quad expectedWorldSpaceFarQuad = {
			CVector3D(-91.0000153f, -122.8355865f, 10.0f),
			CVector3D(111.0000153f, -122.8355865f, 10.0f),
			CVector3D(111.0000153f, 20.0f, 152.8355865f),
			CVector3D(-91.0000153f, 20.0f, 152.8355865f)
		};
		CompareQuadsInWorldSpace(camera, farQuad, expectedWorldSpaceFarQuad);
	}

	void test_ortho_plane_points()
	{
		SViewPort viewPort;
		viewPort.m_X = 0;
		viewPort.m_Y = 0;
		viewPort.m_Width = 512;
		viewPort.m_Height = 512;

		CCamera camera;
		camera.SetViewPort(viewPort);
		camera.LookAt(
			CVector3D(10.0f, 20.0f, 10.0f),
			CVector3D(10.0f, 10.0f, 20.0f),
			CVector3D(0.0f, 1.0f, 1.0f).Normalized()
		);
		camera.SetOrthoProjection(2.0f, 128.0f, 10.0f);

		// Zero distance is the origin plane of all camera rays,
		// so all plane points should stay there.
		CCamera::Quad quad;
		camera.GetViewQuad(0.0f, quad);
		for (const CVector3D& point : quad)
		{
			constexpr float EPS = 1e-4f;
			TS_ASSERT_DELTA(point.Z, 0.0f, EPS);
		}

		// Points lying on the near plane.
		CCamera::Quad expectedNearQuad = {
			CVector3D(-5.0f, -5.0f, 2.0f),
			CVector3D(5.0f, -5.0f, 2.0f),
			CVector3D(5.0f, 5.0f, 2.0f),
			CVector3D(-5.0f, 5.0f, 2.0f)
		};
		CCamera::Quad nearQuad;
		camera.GetViewQuad(camera.GetNearPlane(), nearQuad);
		CompareQuads(nearQuad, expectedNearQuad);

		CCamera::Quad expectedWorldSpaceNearQuad = {
			CVector3D(4.9999995f, 15.0502520f, 7.8786793f),
			CVector3D(15.0f, 15.0502520f, 7.8786793f),
			CVector3D(15.0f, 22.1213207f, 14.9497480f),
			CVector3D(4.9999995f, 22.1213207f, 14.9497480f)
		};
		CompareQuadsInWorldSpace(camera, nearQuad, expectedWorldSpaceNearQuad);

		// Points lying on the far plane.
		CCamera::Quad expectedFarQuad = {
			CVector3D(-5.0f, -5.0f, 128.0f),
			CVector3D(5.0f, -5.0f, 128.0f),
			CVector3D(5.0f, 5.0f, 128.0f),
			CVector3D(-5.0f, 5.0f, 128.0f)
		};
		CCamera::Quad farQuad;
		camera.GetViewQuad(camera.GetFarPlane(), farQuad);
		CompareQuads(farQuad, expectedFarQuad);

		CCamera::Quad expectedWorldSpaceFarQuad = {
			CVector3D(4.9999995f, -74.0452118f, 96.9741364f),
			CVector3D(15.0f, -74.0452118f, 96.9741364f),
			CVector3D(15.0f, -66.9741364f, 104.0452118f),
			CVector3D(4.9999995f, -66.9741364f, 104.0452118f)
		};
		CompareQuadsInWorldSpace(camera, farQuad, expectedWorldSpaceFarQuad);
	}
};
